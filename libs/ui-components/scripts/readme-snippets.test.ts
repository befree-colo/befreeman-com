import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);

describe('README snippets', () => {
  it('every snippet is a verbatim excerpt of a compiled typecheck fixture', async () => {
    const readme = await readFile(new URL('README.md', root), 'utf8');
    const snippets = [...readme.matchAll(/<!-- snippet: (\S+) -->\n```\w+\n([\s\S]*?)```/g)];
    expect(snippets.length).toBeGreaterThanOrEqual(4);
    for (const [, file, code] of snippets) {
      const source = await readFile(new URL(file!, root), 'utf8');
      expect(source, `${file} should contain:\n${code}`).toContain(code!.trimEnd());
    }
  });
});
