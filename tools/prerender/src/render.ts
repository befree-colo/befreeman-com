import type { CareerContentBundle } from '@befreeman/content';
import { esc, footer, matchRoute, routeView } from '@befreeman/page-templates';
import { jsonLdScript, pageMeta, personJsonLd, renderHead } from './meta';
import type { PageMeta } from './meta';

const MARKERS = ['<!--bf:head-->', '<!--bf:main-->', '<!--bf:footer-->', '<!--bf:brand-->'] as const;

export function assertTemplate(template: string): void {
  const missing = MARKERS.filter((m) => !template.includes(m));
  if (missing.length) throw new Error(`shell template is missing markers: ${missing.join(', ')} (was it already pre-rendered?)`);
}

export interface RenderedPage {
  html: string;
  meta: PageMeta;
}

/** Fonts the first viewport renders with: preloading them avoids a fallback-font reflow (CLS). */
export const PRELOAD_FONTS = ['inter-latin-wght-normal', 'space-grotesk-latin-wght-normal'] as const;

/** `<link rel="preload">` tags for the built (hashed) font files among `assetFiles`. */
export function fontPreloads(assetFiles: string[], base = '/assets/'): string {
  return PRELOAD_FONTS.map((name) => assetFiles.find((f) => f.startsWith(`${name}.`) && f.endsWith('.woff2')))
    .filter((f): f is string => !!f)
    .map((f) => `<link rel="preload" href="${base}${f}" as="font" type="font/woff2" crossorigin />`)
    .join('\n    ');
}

/** Fill the built shell template with one route's crawlable content. */
export function renderPage(template: string, path: string, b: CareerContentBundle, site: string): RenderedPage {
  assertTemplate(template);
  const route = matchRoute(path);
  const meta = pageMeta(route, b, site);
  const extra = route.kind === 'home' ? jsonLdScript(personJsonLd(b, site)) : '';
  const robots = route.kind === 'not-found' ? '<meta name="robots" content="noindex" />' : '';
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(meta.title)}</title>`)
    .replace('<!--bf:head-->', renderHead(meta, site, [extra, robots].filter(Boolean).join('\n    ')))
    .replace('<!--bf:brand-->befreeman.com', esc(b.profile.name))
    .replace('<!--bf:brand-->', '')
    .replace('<!--bf:footer-->', footer(b).__html)
    .replace('<!--bf:main-->', routeView(route, b).__html);
  // The shell keeps pre-rendered markup when data-route-path matches the URL.
  html = html.replace('<main id="main"', `<main id="main" data-route-path="${esc(route.path)}"`);
  return { html, meta };
}

export function sitemapXml(paths: string[], site: string): string {
  const urls = paths.map((p) => `  <url><loc>${esc(`${site}${p}`)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function robotsTxt(site: string): string {
  return `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${site}/sitemap.xml\n`;
}
