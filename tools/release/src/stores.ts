import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { Miniflare } from 'miniflare';

/** Write-once artifact storage (R2). */
export interface ArtifactStore {
  exists(key: string): Promise<boolean>;
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
}

/** Manifest storage (KV). A single put of `manifest:live` is the atomic promotion. */
export interface ManifestStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

export interface Stores {
  artifacts: ArtifactStore;
  manifests: ManifestStore;
  close?: () => Promise<void>;
}

/** Miniflare-backed stores: tests, and `--local` (persisted where `wrangler dev` reads). */
export async function miniflareStores(mf: Miniflare): Promise<Stores> {
  const bucket = await mf.getR2Bucket('ARTIFACTS');
  const kv = await mf.getKVNamespace('MANIFESTS');
  return {
    artifacts: {
      exists: async (key) => (await bucket.head(key)) !== null,
      put: async (key, body, contentType) => {
        await bucket.put(key, body, { httpMetadata: { contentType } });
      },
    },
    manifests: {
      get: (key) => kv.get(key),
      put: (key, value) => kv.put(key, value),
      list: async (prefix) => {
        const keys: string[] = [];
        let cursor: string | undefined;
        do {
          const page = await kv.list({ prefix, ...(cursor ? { cursor } : {}) });
          keys.push(...page.keys.map((k) => k.name));
          cursor = page.list_complete ? undefined : page.cursor;
        } while (cursor);
        return keys;
      },
    },
    close: () => mf.dispose(),
  };
}

const run = promisify(execFile);

/**
 * Stores backed by the Wrangler CLI.
 * - `remote`: real Cloudflare R2/KV (needs CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID).
 * - `local`: the same local storage `wrangler dev` serves (apps/edge/.wrangler/state).
 */
export function wranglerStores(opts: { cwd: string; bucket: string; env?: string; mode: 'local' | 'remote' }): Stores {
  const envArgs = opts.env ? ['--env', opts.env] : [];
  const where = opts.mode === 'local' ? '--local' : '--remote';
  const wrangler = async (args: string[]) =>
    run('pnpm', ['exec', 'wrangler', ...args, ...envArgs], { cwd: opts.cwd, maxBuffer: 64 * 1024 * 1024 });
  return {
    artifacts: {
      exists: async (key) => {
        const dir = await mkdtemp(join(tmpdir(), 'bf-r2-'));
        try {
          await wrangler(['r2', 'object', 'get', `${opts.bucket}/${key}`, '--file', join(dir, 'probe'), where]);
          return true;
        } catch {
          return false;
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      },
      put: async (key, body, contentType) => {
        const dir = await mkdtemp(join(tmpdir(), 'bf-r2-'));
        try {
          const file = join(dir, 'body');
          await writeFile(file, body);
          await wrangler(['r2', 'object', 'put', `${opts.bucket}/${key}`, '--file', file, '--content-type', contentType, where]);
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      },
    },
    manifests: {
      get: async (key) => {
        let stdout: string;
        try {
          ({ stdout } = await wrangler(['kv', 'key', 'get', key, '--binding', 'MANIFESTS', where, '--text']));
        } catch (e) {
          // Only a missing key means "no value". Anything else (bad token, missing permission, wrong
          // account, network) must surface: swallowing it made production report a verified commit as
          // unverified.
          const err = e as { stdout?: string; stderr?: string; message?: string };
          const out = `${err.stdout ?? ''}\n${err.stderr ?? ''}`;
          // Wrangler 4 reports a missing remote key as a 404 from the values endpoint.
          if (/Value not found|404: Not Found/i.test(out)) return null;
          throw new Error(`wrangler kv key get ${key} failed:\n${out.trim() || err.message}`);
        }
        const value = stdout.trim();
        // Wrangler exits 0 and prints this for a missing key.
        return !value || value === 'Value not found' ? null : value;
      },
      put: async (key, value) => {
        await wrangler(['kv', 'key', 'put', key, value, '--binding', 'MANIFESTS', where]);
      },
      list: async (prefix) => {
        const { stdout } = await wrangler(['kv', 'key', 'list', '--binding', 'MANIFESTS', '--prefix', prefix, where]);
        return (JSON.parse(stdout) as { name: string }[]).map((k) => k.name);
      },
    },
  };
}
