/**
 * `nx run ui-components:manifest`
 * Reads custom-elements.json (from the CEM analyzer) and writes framework typings:
 *   types/elements.d.ts  props + events per tag
 *   types/dom.d.ts       HTMLElementTagNameMap / HTMLElementEventMap (also gives Angular typed $event)
 *   types/react.d.ts     React 19 JSX IntrinsicElements
 *   types/vue.d.ts       Vue GlobalComponents
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { renderTypes } from './render-types';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('custom-elements.json', root), 'utf8'));
const typesSource = await readFile(new URL('src/types.ts', root), 'utf8');
for (const [name, content] of Object.entries(renderTypes(manifest, typesSource))) {
  await writeFile(fileURLToPath(new URL(`types/${name}`, root)), content);
  console.log(`✔ types/${name}`);
}
