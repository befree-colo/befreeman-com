// Proves the README's "adding an achievement" example passes validation as written.
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildBundle } from '../src/bundle';

describe('README authoring guide', () => {
  it('the documented achievement example validates against the real content', async () => {
    const readme = await readFile(fileURLToPath(new URL('../README.md', import.meta.url)), 'utf8');
    const example = /Create `libs\/content\/content\/achievements\/([a-z0-9-]+)\.md`:\s*```markdown\n([\s\S]*?)```/.exec(readme);
    expect(example, 'README example not found').not.toBeNull();
    const [, id, body] = example!;

    const dir = await mkdtemp(join(tmpdir(), 'bf-guide-'));
    try {
      await cp(fileURLToPath(new URL('../content', import.meta.url)), dir, { recursive: true });
      await writeFile(join(dir, 'achievements', `${id}.md`), body!);
      const bundle = await buildBundle(dir);
      const added = bundle.achievements.find((a) => a.id === id);
      expect(added?.placeholder).toBe(false);
      expect(added?.impact).toHaveLength(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
