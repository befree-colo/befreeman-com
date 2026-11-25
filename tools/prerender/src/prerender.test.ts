import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildBundle } from '@befreeman/content/node';
import type { CareerContentBundle } from '@befreeman/content';
import { esc, patentNumber, patentUrl, prerenderPaths } from '@befreeman/page-templates';
import { beforeAll, describe, expect, it } from 'vitest';
import { jsonLdScript, personJsonLd } from './meta';
import { renderOgImage } from './og';
import { assertTemplate, fontPreloads, renderPage, robotsTxt, sitemapXml } from './render';

const SITE = 'https://befreeman.com';
let b: CareerContentBundle;
let template: string;

beforeAll(async () => {
  b = await buildBundle(fileURLToPath(new URL('../../../libs/content/content', import.meta.url)));
  template = await readFile(fileURLToPath(new URL('../../../apps/shell/src/index.html', import.meta.url)), 'utf8');
});

const head = (html: string) => html.slice(html.indexOf('<head>'), html.indexOf('</head>'));

describe('renderPage', () => {
  it('home contains the profile, roles, and achievement titles without JavaScript', () => {
    const { html } = renderPage(template, '/', b, SITE);
    expect(html).toContain(esc(b.profile.name));
    expect(html).toContain(esc(b.profile.headline));
    for (const r of b.roles) expect(html).toContain(esc(r.title));
    for (const a of b.achievements.filter((x) => x.featured)) expect(html).toContain(esc(a.title));
    expect(html).toContain('data-route-path="/"');
    expect(html).not.toContain('<!--bf:');
  });

  it('each achievement page contains its title, summary, and impact', () => {
    for (const a of b.achievements) {
      const { html } = renderPage(template, `/achievements/${a.id}`, b, SITE);
      expect(html).toContain(esc(a.title));
      expect(html).toContain(esc(a.summary));
      for (const i of a.impact) expect(html).toContain(esc(i));
    }
  });

  it('the patents page lists every patent with its number and Google Patents link, without JavaScript', () => {
    const { html, meta } = renderPage(template, '/patents', b, SITE);
    expect(b.patents.length).toBeGreaterThan(0);
    for (const p of b.patents) {
      expect(html).toContain(esc(p.title));
      expect(html).toContain(patentNumber(p.number));
      expect(html).toContain(`href="${patentUrl(p.number)}"`);
    }
    expect(html).toContain('data-route-path="/patents"');
    expect(html).toContain(`<title>Patents · ${esc(b.profile.name)}</title>`);
    expect(html).toContain('<link rel="canonical" href="https://befreeman.com/patents"');
    expect(meta.description).toMatch(/^\d+ issued U\.S\. patents from /);
    expect(meta.imagePath).toBe('/og/patents.png');
  });

  it('the patents achievement links to the patents page', () => {
    const { html } = renderPage(template, '/achievements/data-protection-patents', b, SITE);
    expect(html).toContain('<a href="/patents">all of my issued patents</a>');
  });

  it('reserves slot space to keep layout shift low', () => {
    const { html } = renderPage(template, '/', b, SITE);
    expect(html.match(/class="bf-slot relative min-h-\[\d+rem\]"/g)).toHaveLength(3);
  });

  it('never contains the raw contact email', () => {
    for (const p of prerenderPaths(b.achievements.map((a) => a.id))) expect(renderPage(template, p, b, SITE).html).not.toContain('@example.com');
  });

  it('refuses an already pre-rendered template', () => {
    expect(() => assertTemplate(renderPage(template, '/', b, SITE).html)).toThrow(/missing markers/);
  });
});

describe('metadata', () => {
  it('every page has a unique title, description, canonical URL, OG and Twitter tags', () => {
    const titles = new Set<string>();
    for (const p of prerenderPaths(b.achievements.map((a) => a.id))) {
      const h = head(renderPage(template, p, b, SITE).html);
      const title = /<title>(.*?)<\/title>/.exec(h)?.[1];
      expect(title, p).toBeTruthy();
      titles.add(title!);
      expect(h).toContain(`<link rel="canonical" href="${SITE}${p}" />`);
      for (const tag of ['name="description"', 'property="og:title"', 'property="og:description"', 'property="og:image"', 'property="og:url"', 'name="twitter:card"', 'name="twitter:image"']) {
        expect(h, `${p} ${tag}`).toContain(tag);
      }
    }
    expect(titles.size).toBe(prerenderPaths(b.achievements.map((a) => a.id)).length);
  });

  it('achievement previews use the achievement title and summary', () => {
    const a = b.achievements[0]!;
    const h = head(renderPage(template, `/achievements/${a.id}`, b, SITE).html);
    expect(h).toContain(`<meta property="og:title" content="${esc(`${a.title} · ${b.profile.name}`)}" />`);
    expect(h).toContain(`<meta property="og:description" content="${esc(a.summary)}" />`);
    expect(h).toContain(`<meta property="og:image" content="${SITE}/og/achievements-${a.id}.png" />`);
    expect(h).toContain('<meta property="og:type" content="article" />');
  });

  it('head tags snapshot (home and one achievement)', () => {
    expect(head(renderPage(template, '/', b, SITE).html)).toMatchSnapshot();
    expect(head(renderPage(template, `/achievements/${b.achievements[0]!.id}`, b, SITE).html)).toMatchSnapshot();
  });

  it('the 404 page is not indexed', () => {
    expect(head(renderPage(template, '/404', b, SITE).html)).toContain('<meta name="robots" content="noindex" />');
  });
});

describe('structured data', () => {
  it('home embeds valid JSON-LD Person matching the profile', () => {
    const { html } = renderPage(template, '/', b, SITE);
    const raw = /<script type="application\/ld\+json">(.*?)<\/script>/.exec(html)?.[1];
    expect(raw).toBeTruthy();
    const data = JSON.parse(raw!) as Record<string, unknown>;
    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('Person');
    expect(data['name']).toBe(b.profile.name);
    expect(data['jobTitle']).toBe(b.profile.headline);
    expect(data['sameAs']).toEqual(b.profile.links.map((l) => l.url));
    expect(data['knowsAbout']).toEqual(b.skills.map((s) => s.name));
  });

  it('only the home page carries the Person data', () => {
    expect(renderPage(template, '/skills', b, SITE).html).not.toContain('application/ld+json');
  });

  it('cannot be broken out of with </script>', () => {
    const evil = { ...b, profile: { ...b.profile, name: '</script><script>alert(1)</script>' } };
    const tag = jsonLdScript(personJsonLd(evil, SITE));
    expect(tag.match(/<\/script>/g)).toHaveLength(1);
    expect(JSON.parse(tag.replace(/^<script[^>]*>|<\/script>$/g, ''))['name']).toBe(evil.profile.name);
  });
});

describe('sitemap and robots', () => {
  it('lists every pre-rendered page; a new achievement adds its URL', () => {
    const ids = b.achievements.map((a) => a.id);
    const xml = sitemapXml(prerenderPaths([...ids, 'brand-new-achievement']), SITE);
    expect(xml).toContain('<loc>https://befreeman.com/achievements/brand-new-achievement</loc>');
    for (const id of ids) expect(xml).toContain(`<loc>${SITE}/achievements/${id}</loc>`);
    expect(xml).toContain(`<loc>${SITE}/</loc>`);
    expect(xml).toContain(`<loc>${SITE}/patents</loc>`);
  });

  it('robots allows indexing of public pages and points at the sitemap', () => {
    const txt = robotsTxt(SITE);
    expect(txt).toContain('Allow: /');
    expect(txt).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });
});

describe('preview images', () => {
  it('renders a 1200×630 PNG', async () => {
    const png = await renderOgImage({ eyebrow: 'E', title: 'Title', subtitle: 'Subtitle' });
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });
});

describe('font preloads', () => {
  it('preloads the hashed latin Inter and Space Grotesk files, crossorigin', () => {
    const files = [
      'main.abc.js',
      'inter-latin-wght-normal.6c596dfc.woff2',
      'inter-latin-ext-wght-normal.11111111.woff2',
      'space-grotesk-latin-wght-normal.5a0c43ff.woff2',
      'jetbrains-mono-latin-wght-normal.a865edea.woff2',
    ];
    const links = fontPreloads(files);
    expect(links.split('<link').length - 1).toBe(2);
    expect(links).toContain('href="/assets/inter-latin-wght-normal.6c596dfc.woff2" as="font" type="font/woff2" crossorigin');
    expect(links).toContain('href="/assets/space-grotesk-latin-wght-normal.5a0c43ff.woff2"');
    expect(links).not.toContain('latin-ext');
    expect(links).not.toContain('jetbrains');
  });
});
