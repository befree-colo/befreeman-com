import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { manifestSchema } from '@befreeman/mfe-contract/manifest';
import type { DeploymentManifest } from '@befreeman/mfe-contract/manifest';
import { REMOTE_REGISTRY, isRegisteredRemote } from '@befreeman/mfe-contract/registry';
import type { Stores } from './stores';

export const LIVE = 'manifest:live';
export const HISTORY = 'manifest:history:';

export type ArtifactName = keyof typeof REMOTE_REGISTRY | 'ui';

export class ReleaseError extends Error {
  constructor(
    message: string,
    readonly code: 'duplicate-version' | 'not-published' | 'smoke-failed' | 'no-live-manifest' | 'nothing-to-roll-back' | 'not-verified' | 'invalid',
  ) {
    super(message);
    this.name = 'ReleaseError';
  }
}

const TYPES: Record<string, string> = {
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  map: 'application/json; charset=utf-8',
  html: 'text/html; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  woff2: 'font/woff2',
  woff: 'font/woff',
};
export const contentType = (file: string) => TYPES[file.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';

export function prefixFor(name: ArtifactName, version: string): string {
  return name === 'ui' ? `ui/${version}/` : `remotes/${name}/${version}/`;
}
const markerFor = (name: ArtifactName, version: string) => `${prefixFor(name, version)}.published`;

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir)) {
    const full = join(dir, entry);
    if ((await stat(full)).isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out.sort();
}

export interface PublishResult {
  name: string;
  version: string;
  files: number;
}

/**
 * Upload a build to its immutable versioned prefix. Refuses (without writing
 * anything) if that version was already published. The marker is written last,
 * so a half-finished upload never counts as published.
 */
export async function publish(stores: Stores, name: ArtifactName, version: string, distDir: string, meta: Record<string, string> = {}): Promise<PublishResult> {
  if (name !== 'ui' && !isRegisteredRemote(name)) throw new ReleaseError(`unknown artifact "${name}"`, 'invalid');
  if (!/^[0-9A-Za-z.+_-]{1,64}$/.test(version)) throw new ReleaseError(`invalid version "${version}"`, 'invalid');
  const marker = markerFor(name, version);
  if (await stores.artifacts.exists(marker)) {
    throw new ReleaseError(`${name}@${version} is already published; versions are immutable`, 'duplicate-version');
  }
  const files = await walk(distDir);
  const entry = name === 'ui' ? 'ui.js' : 'remoteEntry.js';
  if (!files.some((f) => relative(distDir, f) === entry)) throw new ReleaseError(`${distDir} has no ${entry}; build ${name} first`, 'invalid');
  const prefix = prefixFor(name, version);
  for (const file of files) {
    const key = prefix + relative(distDir, file).split(sep).join('/');
    await stores.artifacts.put(key, await readFile(file), contentType(file));
  }
  const body = new TextEncoder().encode(JSON.stringify({ name, version, publishedAt: new Date().toISOString(), ...meta }));
  await stores.artifacts.put(marker, body, 'application/json');
  return { name, version, files: files.length };
}

/** Upload a content bundle (content-addressed: `content.<hash>.json`). */
export async function publishContent(stores: Stores, contentDir: string): Promise<{ version: string; url: string }> {
  const latest = JSON.parse(await readFile(join(contentDir, 'content.latest.json'), 'utf8')) as { version: string; file: string };
  const key = `content/${latest.file}`;
  if (await stores.artifacts.exists(key)) throw new ReleaseError(`content ${latest.version} is already published`, 'duplicate-version');
  await stores.artifacts.put(key, await readFile(join(contentDir, latest.file)), 'application/json; charset=utf-8');
  return { version: latest.version, url: `/${key}` };
}

export async function readLive(stores: Stores): Promise<DeploymentManifest | null> {
  const raw = await stores.manifests.get(LIVE);
  return raw ? manifestSchema.parse(JSON.parse(raw)) : null;
}

/** Return `manifest` with `name` pointed at `version`. */
export function withVersion(manifest: DeploymentManifest, name: ArtifactName, version: string): DeploymentManifest {
  const next = structuredClone(manifest);
  if (name === 'ui') {
    next.ui = { version, entry: `/${prefixFor('ui', version)}ui.js` };
  } else {
    const r = REMOTE_REGISTRY[name];
    next.remotes[name] = { version, entry: `/${prefixFor(name, version)}remoteEntry.js`, type: r.type, scope: r.scope, framework: r.framework };
  }
  return manifestSchema.parse(next);
}

/** Atomically make `next` live, recording the previous manifest in history. */
async function swap(stores: Stores, previous: DeploymentManifest | null, next: DeploymentManifest, now: Date): Promise<void> {
  if (previous) await stores.manifests.put(`${HISTORY}${now.toISOString()}`, JSON.stringify(previous));
  await stores.manifests.put(LIVE, JSON.stringify(next));
}

/** Smoke-check `candidate` with `overrides` applied; resolves to a list of failures (empty = pass). */
export type SmokeCheck = (overrides: { name: string; version: string }[], remotesToCheck: string[]) => Promise<string[]>;

export interface PromoteResult {
  previous: DeploymentManifest;
  next: DeploymentManifest;
}

/**
 * Smoke-check a published version against the composed site, then make it live.
 * A `ui` candidate is checked against every live remote. On any failure the live
 * manifest is left untouched.
 */
export async function promote(stores: Stores, name: ArtifactName, version: string, smoke: SmokeCheck, now = new Date()): Promise<PromoteResult> {
  if (!(await stores.artifacts.exists(markerFor(name, version)))) throw new ReleaseError(`${name}@${version} has not been published`, 'not-published');
  const live = await readLive(stores);
  if (!live) throw new ReleaseError('no live manifest; run `release init` first', 'no-live-manifest');
  const next = withVersion(live, name, version);
  const toCheck = name === 'ui' ? Object.keys(live.remotes) : [name];
  const failures = await smoke([{ name, version }], toCheck);
  if (failures.length) throw new ReleaseError(`smoke check failed for ${name}@${version}:\n  - ${failures.join('\n  - ')}`, 'smoke-failed');
  await swap(stores, live, next, now);
  return { previous: live, next };
}

/** Promote a new content bundle (no smoke: content is validated at build time). */
export async function promoteContent(stores: Stores, content: { version: string; url: string }, now = new Date()): Promise<PromoteResult> {
  if (!(await stores.artifacts.exists(content.url.replace(/^\//, '')))) throw new ReleaseError(`content ${content.version} has not been published`, 'not-published');
  const live = await readLive(stores);
  if (!live) throw new ReleaseError('no live manifest; run `release init` first', 'no-live-manifest');
  const next = manifestSchema.parse({ ...live, content });
  await swap(stores, live, next, now);
  return { previous: live, next };
}

/**
 * Point `name` back at an earlier version in one manifest update, without
 * rebuilding. With no version, uses the most recent historical version that
 * differs from the current one.
 */
export async function rollback(stores: Stores, name: ArtifactName, version?: string, now = new Date()): Promise<PromoteResult> {
  const live = await readLive(stores);
  if (!live) throw new ReleaseError('no live manifest', 'no-live-manifest');
  const current = name === 'ui' ? live.ui.version : live.remotes[name]?.version;
  let target = version;
  if (!target) {
    const keys = (await stores.manifests.list(HISTORY)).sort().reverse();
    for (const key of keys) {
      const raw = await stores.manifests.get(key);
      if (!raw) continue;
      const old = manifestSchema.parse(JSON.parse(raw));
      const v = name === 'ui' ? old.ui.version : old.remotes[name]?.version;
      if (v && v !== current) {
        target = v;
        break;
      }
    }
  }
  if (!target) throw new ReleaseError(`no earlier version of ${name} to roll back to`, 'nothing-to-roll-back');
  if (!(await stores.artifacts.exists(markerFor(name, target)))) throw new ReleaseError(`${name}@${target} has not been published`, 'not-published');
  const next = withVersion(live, name, target);
  await swap(stores, live, next, now);
  return { previous: live, next };
}

/** Create the first live manifest from published versions. */
export async function init(
  stores: Stores,
  versions: { ui: string; content: { version: string; url: string }; remotes: Partial<Record<keyof typeof REMOTE_REGISTRY, string>>; shell?: string },
  now = new Date(),
): Promise<DeploymentManifest> {
  let manifest: DeploymentManifest = manifestSchema.parse({
    v: 1,
    ...(versions.shell ? { shell: { version: versions.shell } } : {}),
    content: versions.content,
    ui: { version: versions.ui, entry: `/${prefixFor('ui', versions.ui)}ui.js` },
    remotes: {},
  });
  for (const [name, v] of Object.entries(versions.remotes)) {
    if (!v || !isRegisteredRemote(name)) continue;
    if (!(await stores.artifacts.exists(markerFor(name, v)))) throw new ReleaseError(`${name}@${v} has not been published`, 'not-published');
    manifest = withVersion(manifest, name, v);
  }
  if (!(await stores.artifacts.exists(markerFor('ui', versions.ui)))) throw new ReleaseError(`ui@${versions.ui} has not been published`, 'not-published');
  await swap(stores, await readLive(stores), manifest, now);
  return manifest;
}
