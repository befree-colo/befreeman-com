/**
 * Local edge emulator: serves the built shell, remotes, ui artifact, and content
 * bundle from ONE origin, generates /mfe-manifest.json from the local builds, and
 * applies the production CSP. Used by `pnpm serve:composed` and the e2e suite.
 *
 *   PORT=4300 tsx apps/e2e/src/compose-server.ts
 *
 * Env:
 *   BF_REMOTE_OVERRIDES  JSON object merged into manifest.remotes (e.g. point a remote at a missing entry)
 */
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REMOTE_REGISTRY } from '@befreeman/mfe-contract/registry';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DIST = join(ROOT, 'dist');
const PORT = Number(process.env['PORT'] ?? 4300);

export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const REMOTES = Object.fromEntries(
  Object.entries(REMOTE_REGISTRY).map(([name, r]) => [name, { ...r, dir: r.dist.replace(/^dist\//, '') }]),
) as Record<keyof typeof REMOTE_REGISTRY, (typeof REMOTE_REGISTRY)[keyof typeof REMOTE_REGISTRY] & { dir: string }>;

function localManifest() {
  const latest = JSON.parse(readFileSync(join(DIST, 'libs/content/content.latest.json'), 'utf8')) as {
    version: string;
    file: string;
  };
  const remotes: Record<string, unknown> = {};
  for (const [name, r] of Object.entries(REMOTES)) {
    if (!existsSync(join(DIST, r.dir, 'remoteEntry.js'))) continue;
    remotes[name] = { version: 'local', entry: `/remotes/${name}/local/remoteEntry.js`, type: r.type, scope: r.scope, framework: r.framework };
  }
  const overrides = process.env['BF_REMOTE_OVERRIDES'] ? (JSON.parse(process.env['BF_REMOTE_OVERRIDES']) as object) : {};
  return {
    v: 1,
    shell: { version: 'local' },
    content: { version: latest.version, url: `/content/${latest.file}` },
    ui: { version: 'local', entry: '/ui/local/ui.js' },
    remotes: { ...remotes, ...overrides },
  };
}

async function sendFile(res: ServerResponse, file: string, status = 200, cache = 'no-cache') {
  const body = await readFile(file);
  res.writeHead(status, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': cache,
    'content-security-policy': CSP,
    'x-content-type-options': 'nosniff',
  });
  res.end(body);
}

async function isFile(p: string) {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}

/** Resolve `rel` under `base`, refusing path traversal. */
function within(base: string, rel: string): string | null {
  const full = resolve(base, normalize(rel).replace(/^([/\\])+/, ''));
  return full.startsWith(resolve(base)) ? full : null;
}

export async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://local');
  const path = decodeURIComponent(url.pathname);
  try {
    if (path === '/mfe-manifest.json') {
      res.writeHead(200, { 'content-type': TYPES['.json'] ?? 'application/json', 'cache-control': 'no-cache', 'content-security-policy': CSP });
      return void res.end(JSON.stringify(localManifest()));
    }
    let m = /^\/remotes\/([a-z-]+)\/([^/]+)\/(.+)$/.exec(path);
    if (m) {
      const r = REMOTES[m[1] as keyof typeof REMOTES];
      const file = r && within(join(DIST, r.dir), m[3] ?? '');
      if (file && (await isFile(file))) return sendFile(res, file, 200, 'public, max-age=31536000, immutable');
      res.writeHead(404).end('remote asset not found');
      return;
    }
    m = /^\/ui\/([^/]+)\/(.+)$/.exec(path);
    if (m) {
      const file = within(join(DIST, 'libs/ui-components'), m[2] ?? '');
      if (file && (await isFile(file))) return sendFile(res, file, 200, 'public, max-age=31536000, immutable');
      res.writeHead(404).end('ui asset not found');
      return;
    }
    m = /^\/content\/(.+)$/.exec(path);
    if (m) {
      const file = within(join(DIST, 'libs/content'), m[1] ?? '');
      if (file && (await isFile(file))) return sendFile(res, file, 200, 'public, max-age=31536000, immutable');
      res.writeHead(404).end('content not found');
      return;
    }
    // Shell: static files, then pre-rendered pages, then 404.html (or the SPA index in dev).
    const shellDir = join(DIST, 'apps/shell');
    const asset = within(shellDir, path);
    if (asset && extname(path) && (await isFile(asset))) return sendFile(res, asset);
    const page = within(shellDir, join(path, 'index.html'));
    if (page && (await isFile(page))) return sendFile(res, page);
    const notFound = join(shellDir, '404.html');
    if (await isFile(notFound)) return sendFile(res, notFound, 404);
    return sendFile(res, join(shellDir, 'index.html'));
  } catch (error) {
    res.writeHead(500).end(String(error));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  createServer((req, res) => void handle(req, res)).listen(PORT, () => {
    console.log(`composed site on http://localhost:${PORT}`);
  });
}
