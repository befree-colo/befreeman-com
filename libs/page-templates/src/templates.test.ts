import { fileURLToPath } from 'node:url';
import { buildBundle } from '@befreeman/content/node';
import type { CareerContentBundle } from '@befreeman/content';
import { beforeAll, describe, expect, it } from 'vitest';
import { esc, formatDate, formatYearMonth, html, raw } from './html';
import { patentNumber, patentUrl } from './patents';
import { matchRoute, normalizePath, prerenderPaths } from './routes';
import { routeView } from './views';
import { pageTitle } from './chrome';

let bundle: CareerContentBundle;
beforeAll(async () => {
  bundle = await buildBundle(fileURLToPath(new URL('../../content/content', import.meta.url)));
});

describe('routes', () => {
  it.each([
    ['/', 'home', null, ''],
    ['/achievements', 'achievements', 'achievements', ''],
    ['/achievements/', 'achievements', 'achievements', ''],
    ['/achievements/cloud-migration', 'achievements', 'achievements', 'cloud-migration'],
    ['/timeline', 'timeline', 'timeline', ''],
    ['/skills?x=1#y', 'skills', 'skills', ''],
    ['/timeline/extra', 'not-found', null, ''],
    ['/achievements/a/b', 'not-found', null, ''],
    ['/nope', 'not-found', null, ''],
    ['/achievementsx', 'not-found', null, ''],
    ['/patents', 'patents', 'patents', ''],
    ['/patents/', 'patents', 'patents', ''],
    ['/patents/x', 'not-found', null, ''],
    ['/patentsx', 'not-found', null, ''],
  ])('%s → %s', (path, kind, owner, subPath) => {
    const m = matchRoute(path);
    expect([m.kind, m.owner, m.subPath]).toEqual([kind, owner, subPath]);
  });

  it('home hosts all three remotes; owned routes host one', () => {
    expect(matchRoute('/').slots).toEqual(['achievements', 'timeline', 'skills']);
    expect(matchRoute('/skills').slots).toEqual(['skills']);
    expect(matchRoute('/x').slots).toEqual([]);
    expect(matchRoute('/patents').slots).toEqual(['patents']);
  });

  it('normalizes paths and lists pre-render paths', () => {
    expect(normalizePath('/skills/')).toBe('/skills');
    expect(normalizePath('')).toBe('/');
    expect(prerenderPaths(['a', 'b'])).toEqual(['/', '/achievements', '/achievements/a', '/achievements/b', '/timeline', '/skills', '/patents']);
  });
});

describe('html helpers', () => {
  it('escapes interpolations unless raw', () => {
    expect(html`<p>${'<script>"x"</script>'}</p>`.__html).toBe('<p>&lt;script&gt;&quot;x&quot;&lt;/script&gt;</p>');
    expect(html`<p>${raw('<b>ok</b>')}</p>`.__html).toBe('<p><b>ok</b></p>');
    expect(html`<ul>${['a', 'b'].map((x) => html`<li>${x}</li>`)}</ul>`.__html).toBe('<ul><li>a</li><li>b</li></ul>');
    expect(esc("it's")).toBe('it&#39;s');
  });
  it('formats full dates', () => {
    expect(formatDate('2026-01-20')).toBe('Jan 20, 2026');
    expect(formatDate('2012-07-10')).toBe('Jul 10, 2012');
  });

  it('formats patent numbers and Google Patents links', () => {
    expect(patentNumber('US12530268B2')).toBe('US 12,530,268 B2');
    expect(patentNumber('US8218532B1')).toBe('US 8,218,532 B1');
    expect(patentUrl('US12530268B2')).toBe('https://patents.google.com/patent/US12530268B2/en');
  });

  it('formats year-months', () => {
    expect(formatYearMonth('2021-06')).toBe('Jun 2021');
    expect(formatYearMonth(null)).toBe('Present');
  });
});

describe('views', () => {
  it('home contains hero, featured achievements, every role, and every skill, with three slots', () => {
    const out = routeView(matchRoute('/'), bundle).__html;
    expect(out).toContain(esc(bundle.profile.name));
    expect(out).toContain(esc(bundle.profile.headline));
    for (const a of bundle.achievements.filter((x) => x.featured)) expect(out).toContain(`/achievements/${a.id}`);
    for (const r of bundle.roles) expect(out).toContain(esc(r.title));
    for (const s of bundle.skills) expect(out).toContain(esc(s.name));
    expect(out.match(/data-slot="/g)).toHaveLength(3);
  });

  it('achievement detail shows title, summary, impact, metrics, and the case study', () => {
    const a = bundle.achievements.find((x) => x.caseStudy && x.metrics?.length)!;
    const out = routeView(matchRoute(`/achievements/${a.id}`), bundle).__html;
    expect(out).toContain(esc(a.title));
    expect(out).toContain(esc(a.summary));
    for (const i of a.impact) expect(out).toContain(esc(i));
    for (const m of a.metrics!) expect(out).toContain(esc(m.value));
    expect(out).toContain('id="case-study"');
    expect(out).toContain(`href="/timeline#${a.role}"`);
  });

  it('unknown achievement id renders an in-slot not-found message', () => {
    expect(routeView(matchRoute('/achievements/ghost'), bundle).__html).toContain('Achievement not found');
  });

  it('patents page lists every patent newest first, linked to Google Patents and its role', () => {
    const out = routeView(matchRoute('/patents'), bundle).__html;
    expect(bundle.patents).toHaveLength(12);
    expect(out).toContain('12 issued U.S. patents');
    expect(out.match(/data-slot="[a-z]+"/g)).toEqual(['data-slot="patents"']);
    // The section heading belongs to the remote, so the fallback keeps it inside the slot.
    expect(out.indexOf('data-slot="patents"')).toBeLessThan(out.indexOf('<h1 id="patents-heading"'));
    let last = -1;
    for (const p of bundle.patents) {
      const at = out.indexOf(`id="${p.id}"`);
      expect(at).toBeGreaterThan(last);
      last = at;
      const entry = out.slice(at, out.indexOf('</li>', at));
      expect(entry).toContain(esc(p.title));
      expect(entry).toContain(patentNumber(p.number));
      expect(entry).toContain(`href="${patentUrl(p.number)}" target="_blank" rel="noopener noreferrer"`);
      expect(entry).toContain('(opens Google Patents in a new tab)');
      expect(entry).toContain(`href="/timeline#${p.role}"`);
    }
    expect(out).toContain('href="/timeline#avaya-software-engineer-1999"');
    expect(pageTitle(matchRoute('/patents'), bundle)).toBe(`Patents · ${bundle.profile.name}`);
  });

  it('not-found page links home', () => {
    expect(routeView(matchRoute('/nope'), bundle).__html).toMatch(/Page not found[\s\S]*href="\/"/);
  });

  it('never contains the contact email or token', () => {
    for (const p of prerenderPaths(bundle.achievements.map((a) => a.id))) {
      const out = routeView(matchRoute(p), bundle).__html;
      expect(out).not.toContain('@example.com');
      if (bundle.profile.contactToken) expect(out).not.toContain(bundle.profile.contactToken);
    }
  });
});
