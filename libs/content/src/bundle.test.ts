import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { validFiles, writeFixture } from '../test/fixtures';
import { buildBundle, contentHash, stableStringify, writeBundle } from './bundle';
import type { CareerContentBundle } from './schema';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((c) => c()));
});

describe('bundle', () => {
  it('stableStringify ignores key order', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(stableStringify({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it('produces a content-addressed version that changes only with content', async () => {
    const a = await writeFixture(validFiles());
    const b = await writeFixture(validFiles());
    const files = validFiles();
    files['roles/acme.md'] = files['roles/acme.md']!.replace('Led architecture.', 'Led all architecture.');
    const c = await writeFixture(files);
    cleanups.push(a.cleanup, b.cleanup, c.cleanup);
    const [ba, bb, bc] = await Promise.all([buildBundle(a.dir), buildBundle(b.dir), buildBundle(c.dir)]);
    expect(ba.version).toMatch(/^[0-9a-f]{12}$/);
    expect(ba.version).toBe(bb.version);
    expect(bc.version).not.toBe(ba.version);
    const { version: _v, placeholders: _p, ...rest } = ba;
    expect(contentHash(rest)).toBe(ba.version);
  });

  it('writes the hashed bundle and a latest pointer, removing stale bundles', async () => {
    const src = await writeFixture(validFiles());
    const out = await mkdtemp(join(tmpdir(), 'bf-out-'));
    cleanups.push(src.cleanup, () => rm(out, { recursive: true, force: true }));
    await writeFile(join(out, 'content.000000000000.json'), '{}');

    const { fileName, bundle, warning } = await writeBundle(src.dir, out);

    expect(fileName).toBe(`content.${bundle.version}.json`);
    expect((await readdir(out)).sort()).toEqual(['content.latest.json', fileName].sort());
    const written = JSON.parse(await readFile(join(out, fileName), 'utf8')) as CareerContentBundle;
    expect(written.version).toBe(bundle.version);
    expect(JSON.parse(await readFile(join(out, 'content.latest.json'), 'utf8'))).toEqual({
      version: bundle.version,
      file: fileName,
    });
    expect(warning).toBeNull();
  });

  it('the repository content is valid, and roles, achievements, and skills are real (not placeholders)', async () => {
    const bundle = await buildBundle(fileURLToPath(new URL('../content', import.meta.url)));
    expect(bundle.roles.length).toBeGreaterThanOrEqual(1);
    expect(bundle.achievements.some((a) => a.featured)).toBe(true);
    expect(bundle.skillCategories.length).toBeGreaterThanOrEqual(3);
    expect(bundle.placeholders.byType).toMatchObject({ role: 0, achievement: 0, skill: 0 });
    // Newest first: by date, else by the role's start.
    const start = new Map(bundle.roles.map((r) => [r.id, r.start]));
    const when = bundle.achievements.map((a) => a.date ?? start.get(a.role)!);
    expect(when).toEqual([...when].sort().reverse());
  });
});
