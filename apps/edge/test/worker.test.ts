import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { signPreview } from '@befreeman/mfe-contract/preview';
import type { DeploymentManifest } from '@befreeman/mfe-contract/manifest';
import worker from '../src/index';
import type { Env } from '../src/env';
import { LIVE_MANIFEST_KEY } from '../src/env';

const ORIGIN = 'https://befreeman.com';
const live: DeploymentManifest = {
  v: 1,
  shell: { version: 's1' },
  content: { version: 'c1', url: '/content/content.c1.json' },
  ui: { version: 'u1', entry: '/ui/u1/ui.js' },
  remotes: {
    timeline: { version: '1.0.0-a', entry: '/remotes/timeline/1.0.0-a/remoteEntry.js', type: 'module', scope: 'bf_timeline', framework: 'vue' },
    skills: { version: '1.0.0-a', entry: '/remotes/skills/1.0.0-a/remoteEntry.js', type: 'script', scope: 'bf_skills', framework: 'react' },
  },
};

const assets = {
  fetch: async (req: Request) => {
    const path = new URL(req.url).pathname;
    if (path === '/' || path === '/skills') return new Response('<!doctype html><title>page</title>', { headers: { 'content-type': 'text/html' } });
    return new Response('<!doctype html><title>404</title>', { status: 404, headers: { 'content-type': 'text/html' } });
  },
} as unknown as Fetcher;

// Explicit secret: a developer's local .dev.vars must not change test outcomes.
const testEnv = (): Env => ({ ...(env as unknown as Env), ASSETS: assets, PREVIEW_SECRET: 'test-secret' });
const call = (path: string, init?: RequestInit) => worker.fetch(new Request(`${ORIGIN}${path}`, init), testEnv());

beforeEach(async () => {
  await env.MANIFESTS.put(LIVE_MANIFEST_KEY, JSON.stringify(live));
  await env.ARTIFACTS.put('remotes/timeline/1.0.0-a/remoteEntry.js', 'export const a = 1;');
  await env.ARTIFACTS.put('remotes/timeline/1.1.0-b/remoteEntry.js', 'export const b = 2;');
  await env.ARTIFACTS.put('ui/u2/ui.js', 'export {};');
  await env.ARTIFACTS.put('content/content.c1.json', '{"version":"c1"}', { httpMetadata: { contentType: 'application/json' } });
});

describe('static assets (shell + pre-rendered pages)', () => {
  it('serves pages with the CSP and security headers', async () => {
    const res = await call('/');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-security-policy')).toContain("script-src 'self'");
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('passes through the 404 page with its status', async () => {
    const res = await call('/nope');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('404');
  });

  it('rejects non-GET methods', async () => {
    expect((await call('/', { method: 'POST' })).status).toBe(405);
  });
});

describe('/mfe-manifest.json', () => {
  it('serves the live manifest from KV with no-cache and an ETag', async () => {
    const res = await call('/mfe-manifest.json');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(res.headers.get('etag')).toMatch(/^"[0-9a-f]{24}"$/);
    expect(await res.json()).toEqual(live);
  });

  it('answers 304 when the ETag matches', async () => {
    const etag = (await call('/mfe-manifest.json')).headers.get('etag')!;
    const res = await call('/mfe-manifest.json', { headers: { 'if-none-match': etag } });
    expect(res.status).toBe(304);
  });

  it('a manifest update takes effect on the next request (no shell redeploy)', async () => {
    const next = structuredClone(live);
    next.remotes['timeline']!.version = '1.1.0-b';
    await env.MANIFESTS.put(LIVE_MANIFEST_KEY, JSON.stringify(next));
    const body = (await (await call('/mfe-manifest.json')).json()) as DeploymentManifest;
    expect(body.remotes['timeline']!.version).toBe('1.1.0-b');
  });

  it('503s when nothing has been promoted yet', async () => {
    await env.MANIFESTS.delete(LIVE_MANIFEST_KEY);
    expect((await call('/mfe-manifest.json')).status).toBe(503);
  });
});

describe('versioned artifacts from R2', () => {
  it('serves remote entries with immutable caching and a JS content type', async () => {
    const res = await call('/remotes/timeline/1.0.0-a/remoteEntry.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(res.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    expect(res.headers.get('content-security-policy')).toContain("script-src 'self'");
    expect(await res.text()).toBe('export const a = 1;');
  });

  it('serves the content bundle and ui artifact', async () => {
    expect((await call('/content/content.c1.json')).headers.get('content-type')).toBe('application/json');
    expect((await call('/ui/u2/ui.js')).status).toBe(200);
  });

  it('404s unknown artifacts and refuses traversal', async () => {
    expect((await call('/remotes/timeline/9.9.9/remoteEntry.js')).status).toBe(404);
    // The URL parser resolves %2e%2e segments before the Worker sees them: a harmless 404.
    expect((await call('/remotes/timeline/1.0.0-a/%2e%2e/%2e%2e/secret')).status).toBe(404);
    // Dot segments hidden behind encoded slashes reach the Worker and are refused.
    expect((await call('/remotes/timeline/1.0.0-a/..%2F..%2Fsecret')).status).toBe(400);
    expect((await call('/content/a/b')).status).toBe(404);
  });
});

describe('reserved /api', () => {
  it('returns 404 until the agent change lands', async () => {
    const res = await call('/api/chat');
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

describe('signed preview override (?mfe-override)', () => {
  const qs = async (overrides: { name: string; version: string }[], secret = 'test-secret') =>
    new URLSearchParams(await signPreview(overrides, secret)).toString();

  it('a valid token loads the requested published version', async () => {
    const res = await call(`/mfe-manifest.json?${await qs([{ name: 'timeline', version: '1.1.0-b' }])}`);
    expect(res.headers.get('x-bf-preview')).toBe('applied');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const body = (await res.json()) as DeploymentManifest;
    expect(body.remotes['timeline']).toMatchObject({ version: '1.1.0-b', entry: '/remotes/timeline/1.1.0-b/remoteEntry.js', scope: 'bf_timeline' });
    expect(body.remotes['skills']!.version).toBe('1.0.0-a');
  });

  it('can preview a ui version', async () => {
    const body = (await (await call(`/mfe-manifest.json?${await qs([{ name: 'ui', version: 'u2' }])}`)).json()) as DeploymentManifest;
    expect(body.ui).toEqual({ version: 'u2', entry: '/ui/u2/ui.js' });
  });

  it('a missing token is ignored: the live manifest is served', async () => {
    const res = await call('/mfe-manifest.json?mfe-override=timeline@1.1.0-b');
    expect(res.headers.get('x-bf-preview')).toMatch(/^rejected/);
    expect(((await res.json()) as DeploymentManifest).remotes['timeline']!.version).toBe('1.0.0-a');
  });

  it('a forged token is rejected', async () => {
    const res = await call(`/mfe-manifest.json?${await qs([{ name: 'timeline', version: '1.1.0-b' }], 'wrong-secret')}`);
    expect(res.headers.get('x-bf-preview')).toBe('rejected: bad-signature');
    expect(((await res.json()) as DeploymentManifest).remotes['timeline']!.version).toBe('1.0.0-a');
  });

  it('an unknown (unpublished) version is rejected even with a valid token', async () => {
    const res = await call(`/mfe-manifest.json?${await qs([{ name: 'timeline', version: '6.6.6' }])}`);
    expect(res.headers.get('x-bf-preview')).toBe('rejected: unknown version timeline@6.6.6');
    expect(((await res.json()) as DeploymentManifest).remotes['timeline']!.version).toBe('1.0.0-a');
  });

  it('a signed page request sets a preview cookie that the manifest request honors', async () => {
    const page = await call(`/skills?${await qs([{ name: 'timeline', version: '1.1.0-b' }])}`);
    const cookie = page.headers.get('set-cookie')!;
    expect(cookie).toMatch(/^bf-preview=.+; Path=\/; Max-Age=\d+; HttpOnly; Secure; SameSite=Strict$/);
    const manifest = await call('/mfe-manifest.json', { headers: { cookie: cookie.split(';')[0]! } });
    expect(((await manifest.json()) as DeploymentManifest).remotes['timeline']!.version).toBe('1.1.0-b');
  });

  it('an unsigned page request sets no cookie', async () => {
    expect((await call('/skills?mfe-override=timeline@1.1.0-b')).headers.get('set-cookie')).toBeNull();
  });
});

describe('canonical host: noindex elsewhere (discoverability)', () => {
  const STAGING = 'https://befreeman-edge-staging.example.workers.dev';
  const at = (origin: string, path: string) => worker.fetch(new Request(`${origin}${path}`), testEnv());

  it.each([
    ['HTML page', '/'],
    ['asset 404 page', '/nope'],
    ['manifest', '/mfe-manifest.json'],
    ['versioned artifact', '/remotes/timeline/1.0.0-a/remoteEntry.js'],
    ['missing artifact', '/remotes/timeline/9.9.9-z/remoteEntry.js'],
    ['reserved /api', '/api/anything'],
  ])('a staging host gets X-Robots-Tag: noindex on the %s', async (_label, path) => {
    const res = await at(STAGING, path);
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
  });

  it.each(['/', '/nope', '/mfe-manifest.json', '/remotes/timeline/1.0.0-a/remoteEntry.js'])(
    'befreeman.com never gets noindex (%s)',
    async (path) => {
      expect((await at(ORIGIN, path)).headers.get('x-robots-tag')).toBeNull();
    },
  );

  it('falls back to befreeman.com when CANONICAL_HOST is unset', async () => {
    const env2 = { ...testEnv(), CANONICAL_HOST: undefined };
    expect((await worker.fetch(new Request(`${ORIGIN}/`), env2)).headers.get('x-robots-tag')).toBeNull();
    expect((await worker.fetch(new Request(`${STAGING}/`), env2)).headers.get('x-robots-tag')).toBe(
      'noindex',
    );
  });
});

describe('canonical host: www and http redirects (site-hosting)', () => {
  const get = (url: string, method = 'GET') =>
    worker.fetch(new Request(url, { method, redirect: 'manual' }), testEnv());

  it('www → apex with path and query preserved (301)', async () => {
    const res = await get('https://www.befreeman.com/achievements/first-contentful-paint?tech=vue&x=1');
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(
      'https://befreeman.com/achievements/first-contentful-paint?tech=vue&x=1',
    );
  });

  it('http on the canonical host → https (301)', async () => {
    const res = await get('http://befreeman.com/skills?a=b');
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://befreeman.com/skills?a=b');
  });

  it('http://www goes straight to the https apex in one hop', async () => {
    const res = await get('http://www.befreeman.com/');
    expect(res.headers.get('location')).toBe('https://befreeman.com/');
  });

  it('redirects any method, before method checks', async () => {
    expect((await get('https://www.befreeman.com/', 'POST')).status).toBe(301);
  });

  it('redirect responses carry the security headers, and www is noindex', async () => {
    const res = await get('https://www.befreeman.com/');
    expect(res.headers.get('strict-transport-security')).toContain('max-age=');
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
  });

  it('https apex and other hosts are not redirected', async () => {
    expect((await get('https://befreeman.com/')).status).toBe(200);
    expect((await get('https://befreeman-edge-staging.example.workers.dev/')).status).toBe(200);
    expect((await get('http://localhost:8787/')).status).toBe(200);
  });
});
