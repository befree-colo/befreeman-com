import { manifestSchema } from '@befreeman/mfe-contract/manifest';
import { verifyPreview } from '@befreeman/mfe-contract/preview';
import type { DeploymentManifest } from '@befreeman/mfe-contract/manifest';
import type { PreviewOverride } from '@befreeman/mfe-contract/preview';
import { LIVE_MANIFEST_KEY } from './env';
import type { Env } from './env';

export const PREVIEW_COOKIE = 'bf-preview';

export async function readLiveManifest(env: Env): Promise<DeploymentManifest | null> {
  const raw = await env.MANIFESTS.get(LIVE_MANIFEST_KEY);
  if (!raw) return null;
  return manifestSchema.parse(JSON.parse(raw));
}

/** Object key that proves a version was published (and therefore may be previewed). */
export function entryKey(o: PreviewOverride): string {
  return o.name === 'ui' ? `ui/${o.version}/ui.js` : `remotes/${o.name}/${o.version}/remoteEntry.js`;
}

export type OverrideResult =
  | { status: 'none'; manifest: DeploymentManifest }
  | { status: 'applied'; manifest: DeploymentManifest }
  | { status: 'rejected'; reason: string; manifest: DeploymentManifest };

/** Read preview params from the query string, or from the preview cookie set on the page request. */
export function previewParams(request: Request): URLSearchParams {
  const url = new URL(request.url);
  if (url.searchParams.has('mfe-override')) return url.searchParams;
  const cookie = request.headers.get('cookie') ?? '';
  const value = cookie.split(/;\s*/).find((c) => c.startsWith(`${PREVIEW_COOKIE}=`))?.slice(PREVIEW_COOKIE.length + 1);
  return value ? new URLSearchParams(decodeURIComponent(value)) : new URLSearchParams();
}

export async function applyPreview(env: Env, live: DeploymentManifest, params: URLSearchParams): Promise<OverrideResult> {
  const verdict = await verifyPreview(params, env.PREVIEW_SECRET);
  if (!verdict.ok) return verdict.reason === 'missing' ? { status: 'none', manifest: live } : { status: 'rejected', reason: verdict.reason, manifest: live };
  const next: DeploymentManifest = structuredClone(live);
  for (const o of verdict.overrides) {
    const current = live.remotes[o.name];
    if (o.name !== 'ui' && !current) return { status: 'rejected', reason: `unknown remote ${o.name}`, manifest: live };
    if (!(await env.ARTIFACTS.head(entryKey(o)))) return { status: 'rejected', reason: `unknown version ${o.name}@${o.version}`, manifest: live };
    if (o.name === 'ui') next.ui = { version: o.version, entry: `/${entryKey(o)}` };
    else if (current) next.remotes[o.name] = { ...current, version: o.version, entry: `/${entryKey(o)}` };
  }
  return { status: 'applied', manifest: next };
}

export async function etagFor(body: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body)));
  return `"${[...digest.slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('')}"`;
}
