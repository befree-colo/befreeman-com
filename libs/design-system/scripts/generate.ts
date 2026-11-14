/** `nx run design-system:generate` — write css/*.css from src/tokens.ts. */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { generateAll } from '../src/generate-all';

const outDir = fileURLToPath(new URL('../css/', import.meta.url));
const files = await generateAll();
for (const [name, css] of Object.entries(files)) {
  await writeFile(outDir + name, css);
  console.log(`✔ css/${name}`);
}
