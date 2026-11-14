import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { validFiles, writeFixture } from '../test/fixtures';
import { buildBundle } from './bundle';
import { splitText, toCorpus } from './corpus';
import type { CareerContentBundle, EntityType } from './schema';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((c) => c()));
});

function entityIds(bundle: CareerContentBundle): Record<EntityType, Set<string>> {
  return {
    profile: new Set(['profile']),
    role: new Set(bundle.roles.map((r) => r.id)),
    achievement: new Set(bundle.achievements.map((a) => a.id)),
    caseStudy: new Set(bundle.caseStudies.map((c) => c.id)),
    skill: new Set(bundle.skills.map((s) => s.id)),
  };
}

async function fixtureBundle() {
  const f = await writeFixture(validFiles());
  cleanups.push(f.cleanup);
  return buildBundle(f.dir);
}

describe('toCorpus', () => {
  it('every chunk resolves to exactly one existing entity (fixture)', async () => {
    const bundle = await fixtureBundle();
    const ids = entityIds(bundle);
    const chunks = toCorpus(bundle);
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(ids[chunk.entity.type].has(chunk.entity.id), `${chunk.id} -> missing entity`).toBe(true);
    }
  });

  it('every chunk resolves to an existing entity (repository content)', async () => {
    const bundle = await buildBundle(fileURLToPath(new URL('../content', import.meta.url)));
    const ids = entityIds(bundle);
    for (const chunk of toCorpus(bundle)) {
      expect(ids[chunk.entity.type].has(chunk.entity.id), `${chunk.id} -> missing entity`).toBe(true);
    }
  });

  it('covers every entity with unique chunk ids and site urls', async () => {
    const bundle = await fixtureBundle();
    const chunks = toCorpus(bundle);
    const covered = new Set(chunks.map((c) => `${c.entity.type}:${c.entity.id}`));
    const total = Object.entries(entityIds(bundle)).flatMap(([type, set]) => [...set].map((id) => `${type}:${id}`));
    expect([...covered].sort()).toEqual(total.sort());
    expect(new Set(chunks.map((c) => c.id)).size).toBe(chunks.length);
    expect(chunks.every((c) => c.url.startsWith('/'))).toBe(true);
    expect(chunks.find((c) => c.entity.type === 'achievement' && c.entity.id === 'cloud-migration')?.url).toBe(
      '/achievements/cloud-migration',
    );
  });

  it('includes impact, metrics, resolved technology names, and plain text bodies', async () => {
    const bundle = await fixtureBundle();
    const text = toCorpus(bundle)
      .filter((c) => c.entity.id === 'cloud-migration')
      .map((c) => c.text)
      .join(' ');
    expect(text).toContain('Impact: Cut cost 30%');
    expect(text).toContain('Cost -30%');
    expect(text).toContain('Technologies: AWS, TypeScript');
    expect(text).toContain('Principal Architect at Acme');
    expect(text).not.toMatch(/<[a-z]/);
  });

  it('never leaks the contact email', async () => {
    const bundle = await fixtureBundle();
    expect(JSON.stringify(toCorpus(bundle))).not.toContain('test@example.com');
  });

  it('splits long text into bounded chunks', async () => {
    const bundle = await fixtureBundle();
    bundle.roles[0]!.bodyHtml = `<p>${'A long sentence about the role. '.repeat(100)}</p>`;
    const roleChunks = toCorpus(bundle, 200).filter((c) => c.entity.id === bundle.roles[0]!.id);
    expect(roleChunks.length).toBeGreaterThan(1);
    expect(roleChunks.every((c) => c.text.length <= 200)).toBe(true);
    expect(roleChunks.map((c) => c.id)).toEqual(roleChunks.map((_, i) => `role:${bundle.roles[0]!.id}#${i + 1}`));
  });
});

describe('splitText', () => {
  it('keeps short text whole and drops empty text', () => {
    expect(splitText('Short.')).toEqual(['Short.']);
    expect(splitText('   ')).toEqual([]);
  });
  it('hard-splits a single overlong sentence', () => {
    const parts = splitText('x'.repeat(25), 10);
    expect(parts).toEqual(['x'.repeat(10), 'x'.repeat(10), 'x'.repeat(5)]);
  });
});
