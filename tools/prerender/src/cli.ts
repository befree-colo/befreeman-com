/**
 * `nx run prerender:run` — write crawlable pages into dist/apps/shell:
 *   <route>/index.html for every page, 404.html, og/*.png, sitemap.xml, robots.txt
 * Env: SITE_URL (default https://befreeman.com)
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CareerContentBundle } from '@befreeman/content';
import { prerenderPaths } from '@befreeman/page-templates';
import { renderOgImage } from './og';
import { fontPreloads, PRELOAD_FONTS, renderPage, robotsTxt, sitemapXml } from './render';

const dist = fileURLToPath(new URL('../../../dist/', import.meta.url));
const shellDir = join(dist, 'apps/shell');
const site = (process.env['SITE_URL'] ?? 'https://befreeman.com').replace(/\/$/, '');

const latest = JSON.parse(await readFile(join(dist, 'libs/content/content.latest.json'), 'utf8')) as { file: string };
const bundle = JSON.parse(await readFile(join(dist, 'libs/content', latest.file), 'utf8')) as CareerContentBundle;

// Keep the pristine template so re-running is idempotent.
const templatePath = join(shellDir, 'index.template.html');
if (!existsSync(templatePath)) await rename(join(shellDir, 'index.html'), templatePath);
const preloads = fontPreloads(await readdir(join(shellDir, 'assets')));
if (preloads.split('<link').length - 1 !== PRELOAD_FONTS.length) throw new Error(`expected ${PRELOAD_FONTS.length} font files to preload in dist/apps/shell/assets`);
const template = (await readFile(templatePath, 'utf8')).replace('<!--bf:head-->', `${preloads}\n    <!--bf:head-->`);

const paths = prerenderPaths(bundle.achievements.map((a) => a.id));
const images = new Map<string, { eyebrow: string; title: string; subtitle: string }>();

for (const path of paths) {
  const { html, meta } = renderPage(template, path, bundle, site);
  const out = path === '/' ? join(shellDir, 'index.html') : join(shellDir, path, 'index.html');
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, html);
  images.set(meta.imagePath, meta.image);
}
const notFound = renderPage(template, '/404', bundle, site);
await writeFile(join(shellDir, '404.html'), notFound.html);

await mkdir(join(shellDir, 'og'), { recursive: true });
for (const [imagePath, image] of images) await writeFile(join(shellDir, imagePath), await renderOgImage(image));

await writeFile(join(shellDir, 'sitemap.xml'), sitemapXml(paths, site));
await writeFile(join(shellDir, 'robots.txt'), robotsTxt(site));
console.log(`✔ pre-rendered ${paths.length} pages + 404, ${images.size} preview images, sitemap.xml, robots.txt (${site})`);
