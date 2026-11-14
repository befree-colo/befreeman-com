import { PREVIEW_PARAMS, verifyPreview } from '@befreeman/mfe-contract/preview';
import type { Env } from './env';
import { IMMUTABLE, contentTypeFor, withSecurityHeaders } from './headers';
import { PREVIEW_COOKIE, applyPreview, etagFor, previewParams, readLiveManifest } from './manifest';

const ARTIFACT_ROUTE = /^\/(remotes\/[a-z][a-z0-9-]*\/[0-9A-Za-z.+_-]+\/.+|ui\/[0-9A-Za-z.+_-]+\/.+|content\/[^/]+)$/;

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
}

async function serveManifest(request: Request, env: Env): Promise<Response> {
  const live = await readLiveManifest(env);
  if (!live) return json(503, { error: 'no live manifest' }, { 'cache-control': 'no-store' });
  const result = await applyPreview(env, live, previewParams(request));
  const body = JSON.stringify(result.manifest);
  const etag = await etagFor(body);
  const headers: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': result.status === 'applied' ? 'private, no-store' : 'no-cache',
    etag,
  };
  if (result.status !== 'none') headers['x-bf-preview'] = result.status === 'applied' ? 'applied' : `rejected: ${result.reason}`;
  if (result.status === 'none' && request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
  return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers });
}

async function serveArtifact(key: string, request: Request, env: Env): Promise<Response> {
  if (key.split('/').some((seg) => seg === '..' || seg === '.')) return json(400, { error: 'bad path' });
  const object = await env.ARTIFACTS.get(key);
  if (!object) return json(404, { error: 'not found' }, { 'cache-control': 'no-store' });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  if (!headers.get('content-type')) headers.set('content-type', contentTypeFor(key));
  headers.set('cache-control', IMMUTABLE);
  headers.set('etag', object.httpEtag);
  return new Response(request.method === 'HEAD' ? null : object.body, { headers });
}

/** Page request carrying signed preview params: remember them in a short-lived cookie for /mfe-manifest.json. */
async function previewCookie(request: Request, env: Env): Promise<string | null> {
  const url = new URL(request.url);
  if (!url.searchParams.has(PREVIEW_PARAMS.override)) return null;
  const verdict = await verifyPreview(url.searchParams, env.PREVIEW_SECRET);
  if (!verdict.ok) return null;
  const value = new URLSearchParams();
  for (const k of Object.values(PREVIEW_PARAMS)) value.set(k, url.searchParams.get(k) ?? '');
  const maxAge = Math.max(0, Number(url.searchParams.get(PREVIEW_PARAMS.exp)) - Math.floor(Date.now() / 1000));
  return `${PREVIEW_COOKIE}=${encodeURIComponent(value.toString())}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return withSecurityHeaders(json(405, { error: 'method not allowed' }, { allow: 'GET, HEAD' }));
    }
    const url = new URL(request.url);
    let path: string;
    try {
      path = decodeURIComponent(url.pathname);
    } catch {
      return withSecurityHeaders(json(400, { error: 'bad path' }));
    }

    if (path === '/mfe-manifest.json') return withSecurityHeaders(await serveManifest(request, env));
    if (path.startsWith('/api/')) {
      // Reserved for the career agent (future change).
      return withSecurityHeaders(json(404, { error: 'not found' }, { 'cache-control': 'no-store' }));
    }
    const artifact = ARTIFACT_ROUTE.exec(path);
    if (artifact?.[1]) return withSecurityHeaders(await serveArtifact(artifact[1], request, env));
    if (/^\/(remotes|ui|content)\//.test(path)) return withSecurityHeaders(json(404, { error: 'not found' }));

    const res = withSecurityHeaders(await env.ASSETS.fetch(request));
    const cookie = await previewCookie(request, env);
    if (cookie) res.headers.append('set-cookie', cookie);
    return res;
  },
} satisfies ExportedHandler<Env>;
