import type { CareerContentBundle } from '@befreeman/content';
import { esc, pageTitle } from '@befreeman/page-templates';
import type { RouteMatch } from '@befreeman/page-templates';

export interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  ogType: 'profile' | 'article' | 'website';
  /** Path of the generated preview image, e.g. `/og/home.png`. */
  imagePath: string;
  image: { eyebrow: string; title: string; subtitle: string };
}

export function slugFor(path: string): string {
  return path === '/' ? 'home' : path.replace(/^\//, '').replace(/\//g, '-');
}

const clip = (s: string, n = 160) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

export function pageMeta(route: RouteMatch, b: CareerContentBundle, site: string): PageMeta {
  const p = b.profile;
  const canonical = `${site}${route.path === '/' ? '/' : route.path}`;
  const imagePath = `/og/${slugFor(route.kind === 'not-found' ? '/' : route.path)}.png`;
  const title = pageTitle(route, b);
  switch (route.kind) {
    case 'home':
      return {
        title,
        description: clip(p.valueStatement),
        canonical,
        ogType: 'profile',
        imagePath,
        image: { eyebrow: p.headline, title: p.name, subtitle: p.valueStatement },
      };
    case 'achievements': {
      const a = route.subPath ? b.achievements.find((x) => x.id === route.subPath) : undefined;
      if (a) {
        return {
          title,
          description: clip(a.summary),
          canonical,
          ogType: 'article',
          imagePath,
          image: { eyebrow: `Achievement · ${p.name}`, title: a.title, subtitle: a.impact[0] ?? a.summary },
        };
      }
      return {
        title,
        description: clip(`Achievements and case studies from ${p.name}: outcomes delivered, with the evidence behind them.`),
        canonical,
        ogType: 'website',
        imagePath,
        image: { eyebrow: p.name, title: 'Achievements', subtitle: 'Outcomes delivered, with the evidence behind them.' },
      };
    }
    case 'timeline':
      return {
        title,
        description: clip(`The career of ${p.name}: ${b.roles.map((r) => `${r.title} at ${r.company}`).join('; ')}.`),
        canonical,
        ogType: 'website',
        imagePath,
        image: { eyebrow: p.name, title: 'Career timeline', subtitle: `${b.roles.length} roles, newest first.` },
      };
    case 'skills':
      return {
        title,
        description: clip(`Skills of ${p.name}: ${b.skills.map((s) => s.name).join(', ')}.`),
        canonical,
        ogType: 'website',
        imagePath,
        image: { eyebrow: p.name, title: 'Skills', subtitle: b.skillCategories.map((c) => c.name).join(' · ') },
      };
    case 'not-found':
      return {
        title,
        description: clip(p.valueStatement),
        canonical: `${site}/404`,
        ogType: 'website',
        imagePath,
        image: { eyebrow: p.headline, title: p.name, subtitle: p.valueStatement },
      };
  }
}

/** Structured data for the home page, derived only from career content. */
export function personJsonLd(b: CareerContentBundle, site: string): Record<string, unknown> {
  const p = b.profile;
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: p.name,
    jobTitle: p.headline,
    description: p.valueStatement,
    url: `${site}/`,
    image: `${site}/og/home.png`,
    ...(p.location ? { address: { '@type': 'PostalAddress', addressRegion: p.location } } : {}),
    sameAs: p.links.map((l) => l.url),
    knowsAbout: b.skills.map((s) => s.name),
    hasOccupation: b.roles.map((r) => ({ '@type': 'Occupation', name: r.title, ...(r.location ? { occupationLocation: { '@type': 'Place', name: r.location } } : {}) })),
  };
}

/** JSON-LD safe for embedding in HTML (no `</script>` breakouts). */
export function jsonLdScript(data: unknown): string {
  const json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  return `<script type="application/ld+json">${json}</script>`;
}

export function renderHead(meta: PageMeta, site: string, extra = ''): string {
  const image = `${site}${meta.imagePath}`;
  const tags = [
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<link rel="canonical" href="${esc(meta.canonical)}" />`,
    `<meta property="og:type" content="${meta.ogType}" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${esc(meta.canonical)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(meta.image.title)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
  ];
  return tags.join('\n    ') + (extra ? `\n    ${extra}` : '');
}
