import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Miniflare } from 'miniflare';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HISTORY, LIVE, ReleaseError, init, promote, promoteContent, publish, publishContent, readLive, rollback } from './release';
import type { SmokeCheck } from './release';
import { miniflareStores } from './stores';
import type { Stores } from './stores';

let stores: Stores;
let tmp: string;

async function fakeBuild(entry: 'remoteEntry.js' | 'ui.js', extra: Record<string, string> = {}): Promise<string> {
  const dir = await mkdtemp(join(tmp, 'build-'));
  await writeFile(join(dir, entry), `/* ${entry} */`);
  for (const [path, body] of Object.entries({ 'assets/chunk.js': 'export {}', ...extra })) {
    await mkdir(join(dir, path, '..'), { recursive: true });
    await writeFile(join(dir, path), body);
  }
  return dir;
}

const pass: SmokeCheck = async () => [];
const t = (n: number) => new Date(Date.UTC(2026, 10, 13, 12, 0, n));

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'bf-release-'));
  stores = await miniflareStores(
    new Miniflare({ modules: true, script: 'export default { fetch: () => new Response("") }', r2Buckets: ['ARTIFACTS'], kvNamespaces: ['MANIFESTS'] }),
  );
});
afterEach(async () => {
  await stores.close?.();
  await rm(tmp, { recursive: true, force: true });
});

async function bootstrap() {
  await publish(stores, 'timeline', '1.0.0-a', await fakeBuild('remoteEntry.js'));
  await publish(stores, 'skills', '1.0.0-a', await fakeBuild('remoteEntry.js'));
  await publish(stores, 'ui', '1.0.0-a', await fakeBuild('ui.js'));
  const contentDir = await mkdtemp(join(tmp, 'content-'));
  await writeFile(join(contentDir, 'content.latest.json'), JSON.stringify({ version: 'c1', file: 'content.c1.json' }));
  await writeFile(join(contentDir, 'content.c1.json'), '{"version":"c1"}');
  const content = await publishContent(stores, contentDir);
  return init(stores, { ui: '1.0.0-a', content, remotes: { timeline: '1.0.0-a', skills: '1.0.0-a' } }, t(0));
}

describe('publish', () => {
  it('uploads every file under the immutable versioned prefix with content types', async () => {
    const res = await publish(stores, 'timeline', '1.2.0-abc', await fakeBuild('remoteEntry.js', { 'assets/app.css': 'a{}' }));
    expect(res.files).toBe(3);
    for (const key of ['remoteEntry.js', 'assets/chunk.js', 'assets/app.css', '.published']) {
      expect(await stores.artifacts.exists(`remotes/timeline/1.2.0-abc/${key}`), key).toBe(true);
    }
  });

  it('refuses to re-publish an existing version without modifying it', async () => {
    await publish(stores, 'timeline', '1.2.0-abc', await fakeBuild('remoteEntry.js'));
    const put = vi.spyOn(stores.artifacts, 'put');
    await expect(publish(stores, 'timeline', '1.2.0-abc', await fakeBuild('remoteEntry.js'))).rejects.toMatchObject({ code: 'duplicate-version' });
    expect(put).not.toHaveBeenCalled();
  });

  it('rejects builds without an entry, unknown names, and bad versions', async () => {
    const empty = await mkdtemp(join(tmp, 'empty-'));
    await writeFile(join(empty, 'x.js'), '');
    await expect(publish(stores, 'skills', '1', empty)).rejects.toThrow(/no remoteEntry.js/);
    await expect(publish(stores, 'nope' as never, '1', empty)).rejects.toThrow(/unknown artifact/);
    await expect(publish(stores, 'skills', '../1', empty)).rejects.toThrow(/invalid version/);
  });
});

describe('promote', () => {
  it('smoke-checks, then atomically swaps the live manifest and records history', async () => {
    const before = await bootstrap();
    await publish(stores, 'timeline', '1.1.0-b', await fakeBuild('remoteEntry.js'));
    const smoke = vi.fn(pass);
    const { next } = await promote(stores, 'timeline', '1.1.0-b', smoke, t(5));
    expect(smoke).toHaveBeenCalledWith([{ name: 'timeline', version: '1.1.0-b' }], ['timeline']);
    expect(next.remotes['timeline']).toMatchObject({ version: '1.1.0-b', entry: '/remotes/timeline/1.1.0-b/remoteEntry.js', scope: 'bf_timeline', framework: 'vue' });
    expect((await readLive(stores))?.remotes['timeline']?.version).toBe('1.1.0-b');
    expect((await readLive(stores))?.remotes['skills']?.version).toBe('1.0.0-a');
    expect(JSON.parse((await stores.manifests.get(`${HISTORY}${t(5).toISOString()}`))!)).toEqual(before);
  });

  it('leaves the live manifest untouched when the smoke check fails', async () => {
    const before = await bootstrap();
    await publish(stores, 'timeline', '1.1.0-b', await fakeBuild('remoteEntry.js'));
    await expect(promote(stores, 'timeline', '1.1.0-b', async () => ['console error: boom'], t(5))).rejects.toMatchObject({ code: 'smoke-failed' });
    expect(await readLive(stores)).toEqual(before);
    expect(await stores.manifests.list(HISTORY)).toEqual([]);
  });

  it('a ui promotion is checked against every live remote and blocked if any fails', async () => {
    const before = await bootstrap();
    await publish(stores, 'ui', '2.0.0-x', await fakeBuild('ui.js'));
    const smoke: SmokeCheck = vi.fn(async (_o, remotes) => (remotes.includes('skills') ? ['skills: mount failed with ui@2.0.0-x'] : []));
    await expect(promote(stores, 'ui', '2.0.0-x', smoke, t(5))).rejects.toThrow(/skills: mount failed/);
    expect(smoke).toHaveBeenCalledWith([{ name: 'ui', version: '2.0.0-x' }], ['timeline', 'skills']);
    expect(await readLive(stores)).toEqual(before);
  });

  it('refuses unpublished versions', async () => {
    await bootstrap();
    await expect(promote(stores, 'timeline', '9.9.9', pass)).rejects.toMatchObject({ code: 'not-published' });
  });

  it('promotes a new content bundle', async () => {
    await bootstrap();
    const dir = await mkdtemp(join(tmp, 'content2-'));
    await writeFile(join(dir, 'content.latest.json'), JSON.stringify({ version: 'c2', file: 'content.c2.json' }));
    await writeFile(join(dir, 'content.c2.json'), '{}');
    const c2 = await publishContent(stores, dir);
    await promoteContent(stores, c2, t(6));
    expect((await readLive(stores))?.content).toEqual({ version: 'c2', url: '/content/content.c2.json' });
    await expect(publishContent(stores, dir)).rejects.toMatchObject({ code: 'duplicate-version' });
  });
});

describe('rollback', () => {
  it('restores the previous version in one manifest update, keeping the faulty artifacts', async () => {
    await bootstrap();
    await publish(stores, 'timeline', '1.1.0-b', await fakeBuild('remoteEntry.js'));
    await promote(stores, 'timeline', '1.1.0-b', pass, t(5));
    await promote(stores, 'skills', '1.0.0-a', pass, t(6)); // unrelated promotion in between
    const put = vi.spyOn(stores.manifests, 'put');

    const { next } = await rollback(stores, 'timeline', undefined, t(7));

    expect(next.remotes['timeline']?.version).toBe('1.0.0-a');
    expect(put.mock.calls.filter(([key]) => key === LIVE)).toHaveLength(1);
    expect(await stores.artifacts.exists('remotes/timeline/1.1.0-b/remoteEntry.js')).toBe(true);
  });

  it('rolls back to an explicit version', async () => {
    await bootstrap();
    await publish(stores, 'skills', '1.1.0-b', await fakeBuild('remoteEntry.js'));
    await publish(stores, 'skills', '1.2.0-c', await fakeBuild('remoteEntry.js'));
    await promote(stores, 'skills', '1.1.0-b', pass, t(5));
    await promote(stores, 'skills', '1.2.0-c', pass, t(6));
    expect((await rollback(stores, 'skills', '1.0.0-a', t(7))).next.remotes['skills']?.version).toBe('1.0.0-a');
  });

  it('explains when there is nothing to roll back to', async () => {
    await bootstrap();
    await expect(rollback(stores, 'timeline')).rejects.toBeInstanceOf(ReleaseError);
    await expect(rollback(stores, 'timeline')).rejects.toMatchObject({ code: 'nothing-to-roll-back' });
  });
});
