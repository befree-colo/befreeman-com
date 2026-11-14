import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { renderTypes } from './render-types';

const root = new URL('../', import.meta.url);
const read = (p: string) => readFile(new URL(p, root), 'utf8');

describe('generated framework typings', () => {
  it('committed types/ match custom-elements.json (run `nx run ui-components:manifest` if this fails)', async () => {
    const manifest = JSON.parse(await read('custom-elements.json'));
    const generated = renderTypes(manifest, await read('src/types.ts'));
    for (const [name, content] of Object.entries(generated)) expect(await read(`types/${name}`), name).toBe(content);
  });

  it('the manifest describes all five components with their events', async () => {
    const manifest = JSON.parse(await read('custom-elements.json')) as {
      modules: { declarations?: { tagName?: string; events?: { name: string }[] }[] }[];
    };
    const decls = manifest.modules.flatMap((m) => m.declarations ?? []).filter((d) => d.tagName);
    expect(decls.map((d) => d.tagName).sort()).toEqual(['bf-button', 'bf-card', 'bf-chip', 'bf-dialog', 'bf-theme-toggle']);
    expect(decls.find((d) => d.tagName === 'bf-chip')?.events?.map((e) => e.name)).toEqual(['bf-toggle']);
  });

  it('maps events to React `on<event>` and Vue `on<CamelEvent>` props', async () => {
    expect(await read('types/react.d.ts')).toContain('`on${K & string}`');
    expect(await read('types/vue.d.ts')).toContain('`on${Camel<K & string>}`');
    expect(await read('types/dom.d.ts')).toContain("'bf-toggle': BfElementEvents['bf-chip']['bf-toggle'];");
  });
});
