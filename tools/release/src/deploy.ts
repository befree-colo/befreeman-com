import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ArtifactName } from './release';
import { ReleaseError, init, promote, promoteContent, publish, publishContent, readLive } from './release';
import type { SmokeCheck } from './release';
import type { Stores } from './stores';

/** KV key (in each environment's MANIFESTS namespace) holding the last fully deployed commit. */
export const DEPLOY_COMMIT = 'deploy:commit';
/** Staging KV key prefix: `deploy:verified:<sha>` exists once that commit passed e2e on staging. */
export const VERIFIED_PREFIX = 'deploy:verified:';

export type DeployPart = ArtifactName | 'content';

/** Nx project → released artifact. Projects not listed (shell, edge, prerender, ...) ship with the Worker, which is always deployed. */
export const PROJECT_ARTIFACTS: Record<string, DeployPart> = {
  'remote-achievements': 'achievements',
  'remote-timeline': 'timeline',
  'remote-skills': 'skills',
  'ui-components': 'ui',
  content: 'content',
};

/** Promotion order: ui first (smoke-checked against every live remote), then remotes, then content. */
export const ALL_PARTS: readonly DeployPart[] = ['ui', 'achievements', 'timeline', 'skills', 'content'];

/**
 * Map affected Nx projects to the parts to release, in promotion order.
 * `null` (first deploy, unknown base, or `--all`) plans every part.
 */
export function planDeploy(affectedProjects: readonly string[] | null): DeployPart[] {
  if (affectedProjects === null) return [...ALL_PARTS];
  const wanted = new Set(affectedProjects.map((p) => PROJECT_ARTIFACTS[p]).filter((a): a is DeployPart => a !== undefined));
  return ALL_PARTS.filter((p) => wanted.has(p));
}

export interface DeployDeps {
  /** The target environment's stores. */
  stores: Stores;
  /** Staging's stores, read by a production deploy to check verification. */
  stagingStores?: Stores;
  env: 'staging' | 'production';
  /** Full SHA of the commit being deployed. */
  head: string;
  /** Force a full release (first deploy, after a rollback). */
  all?: boolean;
  /** Nx projects affected between `base` and HEAD, or null when `base` is not in this checkout's history. */
  affected(base: string): Promise<string[] | null>;
  /** Build the planned parts plus the shell and pre-rendered pages. */
  build(parts: DeployPart[]): Promise<void>;
  versionFor(part: Exclude<DeployPart, 'content'>): string;
  distFor(part: Exclude<DeployPart, 'content'>): string;
  contentDir: string;
  smoke: SmokeCheck;
  /** Upload the Worker and shell (`wrangler deploy`). */
  deployWorker(): Promise<void>;
  log(message: string): void;
}

export interface DeployResult {
  plan: DeployPart[];
  base: string | null;
  promoted: string[];
  initialized: boolean;
}

/** Refuse a production deploy unless staging verified exactly this commit. */
export async function assertVerifiedOnStaging(stagingStores: Stores, head: string): Promise<void> {
  if (!(await stagingStores.manifests.get(`${VERIFIED_PREFIX}${head}`))) {
    throw new ReleaseError(
      `commit ${head.slice(0, 7)} has not been verified on staging. Deploy it to staging first (run tools/deploy/deploy.sh staging on this commit); production only receives commits whose staging e2e run passed.`,
      'not-verified',
    );
  }
}

export async function markVerified(stagingStores: Stores, head: string, now = new Date()): Promise<void> {
  await stagingStores.manifests.put(`${VERIFIED_PREFIX}${head}`, JSON.stringify({ verifiedAt: now.toISOString() }));
}

/**
 * Plan, build, publish, promote, deploy the Worker, and only then record the deployed commit.
 * Any failure leaves `deploy:commit` unchanged, so the next run retries the same plan.
 */
export async function deploy(d: DeployDeps): Promise<DeployResult> {
  if (d.env === 'production') {
    if (!d.stagingStores) throw new ReleaseError('a production deploy needs staging stores for the verification check', 'invalid');
    await assertVerifiedOnStaging(d.stagingStores, d.head);
  }

  const recorded = await d.stores.manifests.get(DEPLOY_COMMIT);
  const live = await readLive(d.stores);
  let base: string | null = null;
  let affected: string[] | null = null;
  if (d.all) d.log('plan: everything (--all)');
  else if (!live) d.log('plan: everything (no live manifest: first deploy)');
  else if (!recorded) d.log('plan: everything (no recorded deploy commit)');
  else {
    affected = await d.affected(recorded);
    if (affected === null) d.log(`plan: everything (recorded commit ${recorded.slice(0, 7)} is not in this checkout's history)`);
    else base = recorded;
  }
  const plan = planDeploy(affected);
  d.log(`plan: ${plan.length ? plan.join(', ') : 'no artifacts changed'}${base ? ` (since ${base.slice(0, 7)})` : ''}; the Worker and shell are always deployed`);

  await d.build(plan);

  // Publish (idempotent: a re-run after a failure skips what is already uploaded).
  const versions = new Map<DeployPart, string>();
  let content: { version: string; url: string } | null = null;
  for (const part of plan) {
    if (part === 'content') {
      content = await publishContent(d.stores, d.contentDir).catch(async (e: unknown) => {
        if (e instanceof ReleaseError && e.code === 'duplicate-version') return readContentLatest(d.contentDir);
        throw e;
      });
      versions.set(part, content.version);
      d.log(`published content ${content.version}`);
      continue;
    }
    const version = d.versionFor(part);
    versions.set(part, version);
    try {
      await publish(d.stores, part, version, d.distFor(part), { source: version });
      d.log(`published ${part}@${version}`);
    } catch (e) {
      if (!(e instanceof ReleaseError && e.code === 'duplicate-version')) throw e;
      d.log(`${part}@${version} already published`);
    }
  }

  const versionOf = (part: DeployPart): string => {
    const v = versions.get(part);
    if (!v) throw new ReleaseError(`no published version for ${part}`, 'invalid');
    return v;
  };

  // Promote.
  const promoted: string[] = [];
  let initialized = false;
  if (!live) {
    const remotes = Object.fromEntries(plan.filter((p) => p !== 'ui' && p !== 'content').map((p) => [p, versionOf(p)]));
    if (!content || !versions.has('ui')) throw new ReleaseError('a first deploy must include ui and content', 'invalid');
    await init(d.stores, { ui: versionOf('ui'), content, remotes });
    initialized = true;
    promoted.push(...plan.map((p) => `${p}@${versions.get(p)}`));
    d.log('initialized the live manifest');
  } else {
    for (const part of plan) {
      const version = versionOf(part);
      const current = await readLive(d.stores);
      const liveVersion = part === 'content' ? current?.content.version : part === 'ui' ? current?.ui.version : current?.remotes[part]?.version;
      if (liveVersion === version) {
        d.log(`${part}@${version} is already live`);
        continue;
      }
      if (part === 'content') await promoteContent(d.stores, { version, url: `/content/content.${version}.json` });
      else await promote(d.stores, part, version, d.smoke);
      promoted.push(`${part}@${version}`);
      d.log(`promoted ${part}@${version}`);
    }
  }

  await d.deployWorker();
  d.log('deployed the Worker and shell');

  await d.stores.manifests.put(DEPLOY_COMMIT, d.head);
  d.log(`recorded ${DEPLOY_COMMIT} = ${d.head.slice(0, 7)}`);
  return { plan, base, promoted, initialized };
}

async function readContentLatest(contentDir: string): Promise<{ version: string; url: string }> {
  const latest = JSON.parse(await readFile(join(contentDir, 'content.latest.json'), 'utf8')) as { version: string; file: string };
  return { version: latest.version, url: `/content/${latest.file}` };
}
