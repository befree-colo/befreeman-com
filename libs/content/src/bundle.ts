import { createHash } from 'node:crypto';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadContent } from './load';
import type { CareerContentBundle } from './schema';
import { countPlaceholders, formatPlaceholderWarning } from './validate';
import type { UnversionedBundle } from './validate';

/** Deterministic JSON (sorted keys) so the hash only changes when content does. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

export function contentHash(content: UnversionedBundle): string {
  return createHash('sha256').update(stableStringify(content)).digest('hex').slice(0, 12);
}

export function toBundle(content: UnversionedBundle): CareerContentBundle {
  return { version: contentHash(content), ...content, placeholders: countPlaceholders(content) };
}

/** Load, validate, and version the content directory. */
export async function buildBundle(contentDir: string): Promise<CareerContentBundle> {
  const { content } = await loadContent(contentDir);
  return toBundle(content);
}

export interface WrittenBundle {
  bundle: CareerContentBundle;
  fileName: string;
  warning: string | null;
}

/**
 * Writes `content.<hash>.json` (immutable) and `content.latest.json`
 * (`{ version, file }`, used by local dev and the release tooling) to `outDir`.
 */
export async function writeBundle(contentDir: string, outDir: string): Promise<WrittenBundle> {
  const bundle = await buildBundle(contentDir);
  const fileName = `content.${bundle.version}.json`;
  await mkdir(outDir, { recursive: true });
  for (const old of await readdir(outDir)) {
    if (/^content\.[0-9a-f]+\.json$/.test(old) && old !== fileName) await rm(join(outDir, old));
  }
  await writeFile(join(outDir, fileName), JSON.stringify(bundle));
  await writeFile(join(outDir, 'content.latest.json'), JSON.stringify({ version: bundle.version, file: fileName }, null, 2));
  return { bundle, fileName, warning: formatPlaceholderWarning(bundle.placeholders) };
}
