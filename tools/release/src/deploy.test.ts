import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Miniflare } from 'miniflare';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_PARTS, DEPLOY_COMMIT, VERIFIED_PREFIX, deploy, markVerified, planDeploy } from './deploy';
import type { DeployDeps, DeployPart } from './deploy';
import { LIVE, ReleaseError, readLive } from './release';
import type { SmokeCheck } from './release';
import { miniflareStores } from './stores';
import type { Stores } from './stores';

describe('planDeploy', () => {
  it('first deploy / --all / unknown base: everything, in promotion order', () => {
    expect(planDeploy(null)).toEqual(['ui', 'achievements', 'timeline', 'skills', 'content']);
  });

  it('timeline-only change: only the timeline', () => {
    expect(planDeploy(['remote-timeline'])).toEqual(['timeline']);
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
  for (const part of ['ui', 'achievements', 'timeline', 'skills']) {
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
}): Promise<Harness> {
  const root = await fakeDists(opts.head, opts.contentVersion ?? 'c1');
  const h: Harness = { built: [], workerDeploys: 0, logs: [], deps: undefined as unknown as DeployDeps };
  h.deps = {
    stores: opts.stores,
    stagingStores: staging,
    env: opts.env ?? 'staging',
    head: opts.head,
    ...(opts.all ? { all: true } : {}),
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
    const h = await harness({ stores: production, env: 'production', head: SHA_A });
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
