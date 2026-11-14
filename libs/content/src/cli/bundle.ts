/**
 * `nx run content:bundle` — validate the career content and write the hashed bundle.
 * `nx run content:validate` — validate only (`--check`).
 */
import { fileURLToPath } from 'node:url';
import { buildBundle, writeBundle } from '../bundle';
import { ContentValidationError, formatPlaceholderWarning } from '../validate';

const contentDir = fileURLToPath(new URL('../../content', import.meta.url));
const outDir = fileURLToPath(new URL('../../../../dist/libs/content', import.meta.url));
const checkOnly = process.argv.includes('--check');

try {
  if (checkOnly) {
    const bundle = await buildBundle(contentDir);
    console.log(`✔ Career content is valid (version ${bundle.version}).`);
    const warning = formatPlaceholderWarning(bundle.placeholders);
    if (warning) console.warn(warning);
  } else {
    const { fileName, warning } = await writeBundle(contentDir, outDir);
    console.log(`✔ Wrote dist/libs/content/${fileName}`);
    if (warning) console.warn(warning);
  }
} catch (error) {
  if (error instanceof ContentValidationError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
