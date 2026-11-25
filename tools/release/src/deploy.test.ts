import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Miniflare } from 'miniflare';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_PARTS, DEPLOY_COMMIT, VERIFIED_PREFIX, assertVerifiedOnStaging, deploy, markVerified, planDeploy } from './deploy';
import type { DeployDeps, DeployPart } from './deploy';
import { LIVE, ReleaseError, readLive } from './release';
import type { SmokeCheck } from './release';
import { miniflareStores } from './stores';
import type { Stores } from './stores';

describe('planDeploy', () => {
  it('first deploy / --all / unknown base: everything, in promotion order', () => {
    expect(planDeploy(null)).toEqual(['ui', 'achievements', 'timeline', 'skills', 'patents', 'content']);
  });

  it('timeline-only change: only the timeline', () => {
    expect(planDeploy(['remote-timeline'])).toEqual(['timeline']);
    expect(planDeploy(['remote-patents'])).toEqual(['patents']);
  });

  it('shared library change: every dependent part Nx reports, nothing else', () => {
    // Nx's graph expands a change to mfe-contract into its dependents.
    expect(planDeploy(['mfe-contract', 'remote-skills', 'remote-timeline', 'ui-components', 'shell', 'edge', 'release'])).toEqual([
      'ui',
      'timeline',
      'skills',
    ]);
  });

  it('content-only change: content (the shell and pages ship with the Worker)', () => {
    expect(planDeploy(['content', 'prerender', 'shell'])).toEqual(['content']);
  });

  it('nothing changed (or only Worker/shell projects): no artifacts', () => {
    expect(planDeploy([])).toEqual([]);
    expect(planDeploy(['edge', 'shell', 'e2e'])).toEqual([]);
  });
});

let staging: Stores;
let production: Stores;
let tmp: string;

const memStores = () =>
  miniflareStores(new Miniflare({ modules: true, script: 'export default { fetch: () => new Response("") }', r2Buckets: ['ARTIFACTS'], kvNamespaces: ['MANIFESTS'] }));

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'bf-deploy-'));
  staging = await memStores();
  production = await memStores();
});
afterEach(async () => {
  await staging.close?.();
  await production.close?.();
  await rm(tmp, { recursive: true, force: true });
});

/** Fake build output for `sha`: every part's dist, and a content bundle whose version is `contentVersion`. */
async function fakeDists(sha: string, contentVersion: string) {
  const root = join(tmp, sha);
  for (const part of ['ui', 'achievements', 'timeline', 'skills', 'patents']) {
    await mkdir(join(root, part), { recursive: true });
    await writeFile(join(root, part, part === 'ui' ? 'ui.js' : 'remoteEntry.js'), `/* ${part} ${sha} */`);
  }
  await mkdir(join(root, 'content'), { recursive: true });
  await writeFile(join(root, 'content', 'content.latest.json'), JSON.stringify({ version: contentVersion, file: `content.${contentVersion}.json` }));
  await writeFile(join(root, 'content', `content.${contentVersion}.json`), `{"version":"${contentVersion}"}`);
  return root;
}

interface Harness {
  deps: DeployDeps;
  built: DeployPart[][];
  workerDeploys: number;
  logs: string[];
}

async function harness(opts: {
  stores: Stores;
  env?: 'staging' | 'production';
  head: string;
  affected?: string[] | null;
  all?: boolean;
  smoke?: SmokeCheck;
  contentVersion?: string;
  deployWorker?: () => Promise<void>;
  workerSettle?: { attempts: number; delayMs: number };
}): Promise<Harness> {
  const root = await fakeDists(opts.head, opts.contentVersion ?? 'c1');
  const h: Harness = { built: [], workerDeploys: 0, logs: [], deps: undefined as unknown as DeployDeps };
  h.deps = {
    stores: opts.stores,
    stagingStores: staging,
    env: opts.env ?? 'staging',
    head: opts.head,
    ...(opts.all ? { all: true } : {}),
    ...(opts.workerSettle ? { workerSettle: opts.workerSettle } : {}),
    affected: async () => (opts.affected === undefined ? [] : opts.affected),
    build: async (parts) => void h.built.push(parts),
    versionFor: () => `1.0.0-${opts.head.slice(0, 7)}`,
    distFor: (part) => join(root, part),
    contentDir: join(root, 'content'),
    smoke: opts.smoke ?? (async () => []),
    deployWorker:
      opts.deployWorker ??
      (async () => {
        h.workerDeploys++;
      }),
    log: (m) => void h.logs.push(m),
  };
  return h;
}

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

async function firstDeploy(stores: Stores) {
  const h = await harness({ stores, head: SHA_A });
  return deploy(h.deps);
}

describe('deploy', () => {
  it('first deploy: publishes everything, initializes the manifest, deploys the Worker, records the commit', async () => {
    const h = await harness({ stores: staging, head: SHA_A });
    const res = await deploy(h.deps);
    expect(res.initialized).toBe(true);
    expect(res.plan).toEqual([...ALL_PARTS]);
    expect(h.built).toEqual([[...ALL_PARTS]]);
    expect(h.workerDeploys).toBe(1);
    const live = await readLive(staging);
    expect(live?.remotes.timeline?.version).toBe('1.0.0-aaaaaaa');
    expect(live?.content.version).toBe('c1');
    expect(await staging.manifests.get(DEPLOY_COMMIT)).toBe(SHA_A);
  });

  it('timeline-only change: publishes and promotes only the timeline; other live versions unchanged', async () => {
    await firstDeploy(staging);
    const smoke = vi.fn<SmokeCheck>(async () => []);
    const h = await harness({ stores: staging, head: SHA_B, affected: ['remote-timeline'], smoke });
    const res = await deploy(h.deps);
    expect(res.base).toBe(SHA_A);
    expect(res.plan).toEqual(['timeline']);
    expect(h.built).toEqual([['timeline']]);
    expect(smoke).toHaveBeenCalledWith([{ name: 'timeline', version: '1.0.0-bbbbbbb' }], ['timeline']);
    const live = await readLive(staging);
    expect(live?.remotes.timeline?.version).toBe('1.0.0-bbbbbbb');
    expect(live?.remotes.skills?.version).toBe('1.0.0-aaaaaaa');
    expect(live?.ui.version).toBe('1.0.0-aaaaaaa');
    expect(await staging.manifests.get(DEPLOY_COMMIT)).toBe(SHA_B);
  });

  it('nothing changed: no publish or promotion, but the Worker is redeployed and the commit recorded', async () => {
    await firstDeploy(staging);
    const before = await staging.manifests.get(LIVE);
    const h = await harness({ stores: staging, head: SHA_B, affected: ['shell'] });
    const res = await deploy(h.deps);
    expect(res.plan).toEqual([]);
    expect(h.workerDeploys).toBe(1);
    expect(await staging.manifests.get(LIVE)).toBe(before);
    expect(await staging.manifests.get(DEPLOY_COMMIT)).toBe(SHA_B);
  });

  it('a failed smoke check fails the run and leaves the recorded commit and live manifest unchanged', async () => {
    await firstDeploy(staging);
    const before = await staging.manifests.get(LIVE);
    const h = await harness({ stores: staging, head: SHA_B, affected: ['remote-timeline'], smoke: async () => ['timeline: remote state is "failed"'] });
    await expect(deploy(h.deps)).rejects.toMatchObject({ code: 'smoke-failed' });
    expect(h.workerDeploys).toBe(0);
    expect(await staging.manifests.get(LIVE)).toBe(before);
    expect(await staging.manifests.get(DEPLOY_COMMIT)).toBe(SHA_A);
  });

  it('the next run after a failure retries the same parts (re-publish is skipped, not refused)', async () => {
    await firstDeploy(staging);
    const failing = await harness({ stores: staging, head: SHA_B, affected: ['remote-timeline'], smoke: async () => ['boom'] });
    await expect(deploy(failing.deps)).rejects.toBeInstanceOf(ReleaseError);
    const retry = await harness({ stores: staging, head: SHA_B, affected: ['remote-timeline'] });
    const res = await deploy(retry.deps);
    expect(res.promoted).toEqual(['timeline@1.0.0-bbbbbbb']);
    expect(retry.logs).toContain('timeline@1.0.0-bbbbbbb already published');
    expect(await staging.manifests.get(DEPLOY_COMMIT)).toBe(SHA_B);
  });

  /** Staging as it was before a remote existed: first deploy, then drop `name` from the live manifest. */
  async function withoutRemote(name: string) {
    await firstDeploy(staging);
    const live = (await readLive(staging))!;
    delete live.remotes[name];
    await staging.manifests.put(LIVE, JSON.stringify(live));
  }

  it('a new remote is promoted after the Worker deploy, which ships its page', async () => {
    await withoutRemote('patents');
    const order: string[] = [];
    const smoke = vi.fn<SmokeCheck>(async (overrides) => {
      order.push(`smoke ${overrides.map((o) => o.name).join(',')}`);
      return [];
    });
    const h = await harness({
      stores: staging,
      head: SHA_B,
      affected: ['remote-patents', 'remote-timeline'],
      smoke,
      deployWorker: async () => void order.push('worker'),
    });
    const res = await deploy(h.deps);
    expect(order).toEqual(['smoke timeline', 'worker', 'smoke patents']);
    expect(res.promoted).toEqual(['timeline@1.0.0-bbbbbbb', 'patents@1.0.0-bbbbbbb']);
    expect((await readLive(staging))?.remotes.patents).toMatchObject({ version: '1.0.0-bbbbbbb', scope: 'bf_patents', framework: 'svelte' });
    expect(h.logs).toContain('patents is a new remote: promoting it after the Worker deploy, which ships its page');
    expect(await staging.manifests.get(DEPLOY_COMMIT)).toBe(SHA_B);
  });

  it('a new remote failing its smoke check after the Worker deploy leaves it unpromoted and the commit unrecorded', async () => {
    await withoutRemote('patents');
    const failing = await harness({ stores: staging, head: SHA_B, affected: ['remote-patents'], smoke: async () => ['patents: remote state is "failed"'] });
    await expect(deploy(failing.deps)).rejects.toThrow(/smoke check failed for patents/);
    expect(failing.workerDeploys).toBe(1);
    expect((await readLive(staging))?.remotes.patents).toBeUndefined();
    expect(await staging.manifests.get(DEPLOY_COMMIT)).toBe(SHA_A);

    const retry = await harness({ stores: staging, head: SHA_B, affected: ['remote-patents'] });
    await deploy(retry.deps);
    expect((await readLive(staging))?.remotes.patents?.version).toBe('1.0.0-bbbbbbb');
    expect(await staging.manifests.get(DEPLOY_COMMIT)).toBe(SHA_B);
  });

  it("a new remote's smoke check is retried while the new Worker rolls out", async () => {
    await withoutRemote('patents');
    let calls = 0;
    const smoke = vi.fn<SmokeCheck>(async () => (++calls < 3 ? ['patents: console error: Refused to apply style'] : []));
    const h = await harness({ stores: staging, head: SHA_B, affected: ['remote-patents'], smoke, workerSettle: { attempts: 3, delayMs: 0 } });
    const res = await deploy(h.deps);
    expect(smoke).toHaveBeenCalledTimes(3);
    expect(res.promoted).toEqual(['patents@1.0.0-bbbbbbb']);
    expect(h.logs).toContain('patents@1.0.0-bbbbbbb failed its smoke check while the new Worker rolls out; re-checking in 0s (1/3)');
    expect(await staging.manifests.get(DEPLOY_COMMIT)).toBe(SHA_B);
  });

  it('a new remote that keeps failing after every retry fails the deploy', async () => {
    await withoutRemote('patents');
    const smoke = vi.fn<SmokeCheck>(async () => ['patents: remote state is "failed"']);
    const h = await harness({ stores: staging, head: SHA_B, affected: ['remote-patents'], smoke, workerSettle: { attempts: 2, delayMs: 0 } });
    await expect(deploy(h.deps)).rejects.toThrow(/smoke check failed for patents/);
    expect(smoke).toHaveBeenCalledTimes(2);
    expect((await readLive(staging))?.remotes.patents).toBeUndefined();
    expect(await staging.manifests.get(DEPLOY_COMMIT)).toBe(SHA_A);
  });

  it('a failed Worker deploy leaves the recorded commit unchanged', async () => {
    await firstDeploy(staging);
    const h = await harness({
      stores: staging,
      head: SHA_B,
      affected: [],
      deployWorker: async () => {
        throw new Error('wrangler deploy failed');
      },
    });
    await expect(deploy(h.deps)).rejects.toThrow('wrangler deploy failed');
    expect(await staging.manifests.get(DEPLOY_COMMIT)).toBe(SHA_A);
  });

  it('--all re-releases everything; parts already live at that version are not re-promoted', async () => {
    await firstDeploy(staging);
    const h = await harness({ stores: staging, head: SHA_A, all: true });
    const res = await deploy(h.deps);
    expect(res.plan).toEqual([...ALL_PARTS]);
    expect(res.promoted).toEqual([]);
  });

  it('plans everything when the recorded commit is not in the checkout history', async () => {
    await firstDeploy(staging);
    const h = await harness({ stores: staging, head: SHA_B, affected: null });
    const res = await deploy(h.deps);
    expect(res.plan).toEqual([...ALL_PARTS]);
    expect(h.logs.some((l) => l.includes('not in this checkout'))).toBe(true);
  });

  it('a content change promotes the new bundle', async () => {
    await firstDeploy(staging);
    const h = await harness({ stores: staging, head: SHA_B, affected: ['content'], contentVersion: 'c2' });
    await deploy(h.deps);
    expect((await readLive(staging))?.content).toEqual({ version: 'c2', url: '/content/content.c2.json' });
  });
});

describe('production receives what staging verified', () => {
  it('an unverified commit stops before any build or publish, with an explanation', async () => {
    await firstDeploy(staging);
    const h = await harness({ stores: production, env: 'production', head: SHA_B });
    await expect(deploy(h.deps)).rejects.toThrow(/has not been verified on staging\. Deploy it to staging first/);
    expect(h.built).toEqual([]);
    expect(await readLive(production)).toBeNull();
    expect(await production.manifests.get(DEPLOY_COMMIT)).toBeNull();
  });

  it('a commit deployed to staging but not verified is still refused', async () => {
    await firstDeploy(staging);
    const h = await harness({ stores: production, env: 'production', head: SHA_A });
    await expect(deploy(h.deps)).rejects.toMatchObject({ code: 'not-verified' });
  });

  it('waits for a verification marker that is not visible yet (eventually consistent KV)', async () => {
    await markVerified(staging, SHA_A);
    let reads = 0;
    const lagging: Stores = {
      ...staging,
      manifests: { ...staging.manifests, get: async (key) => (++reads < 3 ? null : staging.manifests.get(key)) },
    };
    const logs: string[] = [];
    await assertVerifiedOnStaging(lagging, SHA_A, { attempts: 5, delayMs: 1 }, (l) => logs.push(l));
    expect(reads).toBe(3);
    expect(logs).toHaveLength(2);
  });

  it('still refuses once the wait runs out', async () => {
    await firstDeploy(staging);
    await expect(assertVerifiedOnStaging(staging, SHA_B, { attempts: 3, delayMs: 1 })).rejects.toThrow(/has not been verified on staging/);
  });

  it('says when the staging namespace looks unreachable rather than unverified', async () => {
    await expect(assertVerifiedOnStaging(staging, SHA_A)).rejects.toThrow(/cannot see staging's deploy state/);
  });

  it('a verified commit deploys to production without changing staging', async () => {
    await firstDeploy(staging);
    await markVerified(staging, SHA_A);
    expect(await staging.manifests.get(`${VERIFIED_PREFIX}${SHA_A}`)).toContain('verifiedAt');
    const stagingLive = await staging.manifests.get(LIVE);
    const h = await harness({ stores: production, env: 'production', head: SHA_A });
    const res = await deploy(h.deps);
    expect(res.initialized).toBe(true);
    expect(await production.manifests.get(DEPLOY_COMMIT)).toBe(SHA_A);
    expect(await staging.manifests.get(LIVE)).toBe(stagingLive);
  });
});
