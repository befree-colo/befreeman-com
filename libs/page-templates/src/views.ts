import type { Achievement, CareerContentBundle, Role, Skill } from '@befreeman/content';
import { formatYearMonth, html, raw } from './html';
import type { SafeHtml } from './html';
import { patentsList } from './patents';
import type { RemoteName, RouteMatch } from './routes';

/*
 * Static, crawlable markup shared by the pre-renderer and the shell's client-side
 * navigation. Each remote section is a "slot": its static fallback lives in
 * [data-prerendered] and stays visible if the interactive remote fails.
 */

const SLOT_MIN_HEIGHT: Record<RemoteName, string> = {
  achievements: 'min-h-[28rem]',
  timeline: 'min-h-[32rem]',
  skills: 'min-h-[30rem]',
};

function slot(name: RemoteName, inner: SafeHtml, labelledBy?: string): SafeHtml {
  return html`<div
    class="bf-slot relative ${SLOT_MIN_HEIGHT[name]}"
    data-slot="${name}"
    ${labelledBy ? raw(`aria-labelledby="${labelledBy}"`) : ''}
  >
    <div class="bf-prerendered" data-prerendered>${inner}</div>
  </div>`;
}

function sectionHead(id: string, eyebrow: string, title: string, lede: string, level: 1 | 2 = 2): SafeHtml {
  const heading =
    level === 1
      ? html`<h1 id="${id}" class="font-display text-4xl font-bold">${title}</h1>`
      : html`<h2 id="${id}" class="font-display text-3xl font-bold">${title}</h2>`;
  return html`<header class="mb-10 max-w-3xl">
    <p class="mb-3 font-mono text-sm uppercase tracking-[0.2em] text-accent">${eyebrow}</p>
    ${heading}
    <p class="mt-4 text-lg text-ink-muted">${lede}</p>
  </header>`;
}

const roleById = (b: CareerContentBundle) => new Map(b.roles.map((r) => [r.id, r]));
const skillById = (b: CareerContentBundle) => new Map(b.skills.map((s) => [s.id, s]));

function achievementCard(a: Achievement, roles: Map<string, Role>, skills: Map<string, Skill>): SafeHtml {
  const role = roles.get(a.role);
  return html`<li>
    <a
      href="/achievements/${a.id}"
      class="group block h-full rounded-lg bg-surface-raised p-6 text-ink no-underline shadow-md ring-1 ring-border transition-transform duration-token-base ease-standard hover:-translate-y-1 hover:ring-accent"
    >
      <h3 class="font-display text-xl font-bold group-hover:text-accent">${a.title}</h3>
      ${role ? html`<p class="mt-1 text-sm text-ink-muted">${role.title} · ${role.company}</p>` : ''}
      <p class="mt-3 text-ink-muted">${a.summary}</p>
      <ul class="mt-4 flex flex-wrap gap-2" aria-label="Technologies">
        ${a.skills.map(
          (id) => html`<li class="rounded-pill bg-surface-sunken px-3 py-1 text-xs text-ink">${skills.get(id)?.name ?? id}</li>`,
        )}
      </ul>
    </a>
  </li>`;
}

export function achievementsList(b: CareerContentBundle, opts: { featuredOnly?: boolean } = {}): SafeHtml {
  const roles = roleById(b);
  const skills = skillById(b);
  const items = opts.featuredOnly ? b.achievements.filter((a) => a.featured) : b.achievements;
  return html`<ul class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
    ${items.map((a) => achievementCard(a, roles, skills))}
  </ul>`;
}

export function achievementDetail(b: CareerContentBundle, id: string): SafeHtml {
  const a = b.achievements.find((x) => x.id === id);
  if (!a) {
    return html`<div class="py-16">
      <h1 class="font-display text-4xl font-bold">Achievement not found</h1>
      <p class="mt-4 text-ink-muted">There is no achievement called “${id}”.</p>
      <p class="mt-6"><a href="/achievements">See all achievements</a></p>
    </div>`;
  }
  const role = roleById(b).get(a.role);
  const skills = skillById(b);
  const caseStudy = a.caseStudy ? b.caseStudies.find((c) => c.id === a.caseStudy) : undefined;
  return html`<article class="max-w-3xl">
    <p class="mb-3"><a href="/achievements" class="text-sm">← All achievements</a></p>
    <h1 class="font-display text-4xl font-bold">${a.title}</h1>
    ${role
      ? html`<p class="mt-3 text-ink-muted">
          <a href="/timeline#${role.id}">${role.title} · ${role.company}</a>
          ${a.date ? html` · ${formatYearMonth(a.date)}` : ''}
        </p>`
      : ''}
    <p class="mt-6 text-xl">${a.summary}</p>
    <h2 class="mt-10 font-display text-2xl font-bold">Impact</h2>
    <ul class="mt-4 list-disc space-y-2 pl-6">
      ${a.impact.map((i) => html`<li>${i}</li>`)}
    </ul>
    ${a.metrics?.length
      ? html`<dl class="mt-8 grid gap-4 sm:grid-cols-2">
          ${a.metrics.map(
            (m) => html`<div class="rounded-lg bg-surface-raised p-5 ring-1 ring-border">
              <dt class="text-sm text-ink-muted">${m.label}</dt>
              <dd class="mt-1 font-display text-2xl font-bold text-accent">${m.value}</dd>
            </div>`,
          )}
        </dl>`
      : ''}
    <h2 class="mt-10 font-display text-2xl font-bold">Technologies</h2>
    <ul class="mt-4 flex flex-wrap gap-2">
      ${a.skills.map(
        (id) => html`<li><a class="rounded-pill bg-surface-sunken px-3 py-1 text-sm text-ink no-underline" href="/skills#${id}">${skills.get(id)?.name ?? id}</a></li>`,
      )}
    </ul>
    ${a.bodyHtml ? html`<div class="bf-prose mt-10">${raw(a.bodyHtml)}</div>` : ''}
    ${caseStudy
      ? html`<section id="case-study" class="mt-12 rounded-xl bg-surface-raised p-8 ring-1 ring-border">
          <p class="font-mono text-sm uppercase tracking-[0.2em] text-accent">Case study</p>
          <h2 class="mt-2 font-display text-2xl font-bold">${caseStudy.title}</h2>
          <p class="mt-3 text-ink-muted">${caseStudy.summary}</p>
          <div class="bf-prose mt-6">${raw(caseStudy.bodyHtml)}</div>
        </section>`
      : ''}
  </article>`;
}

export function timelineList(b: CareerContentBundle): SafeHtml {
  const byRole = new Map<string, Achievement[]>();
  for (const a of b.achievements) byRole.set(a.role, [...(byRole.get(a.role) ?? []), a]);
  return html`<ol class="relative space-y-10 border-l-2 border-border pl-8">
    ${b.roles.map(
      (r) => html`<li id="${r.id}" class="relative">
        <span class="absolute top-1.5 -left-[2.6rem] size-4 rounded-pill bg-accent ring-4 ring-surface" aria-hidden="true"></span>
        <p class="font-mono text-sm text-ink-muted">${formatYearMonth(r.start)} – ${formatYearMonth(r.end)}</p>
        <h3 class="mt-1 font-display text-2xl font-bold">${r.title}</h3>
        <p class="text-lg text-accent">${r.company}</p>
        <p class="mt-3 text-ink-muted">${r.summary}</p>
        <ul class="mt-3 list-disc space-y-1 pl-6">
          ${r.responsibilities.map((x) => html`<li>${x}</li>`)}
        </ul>
        ${(byRole.get(r.id) ?? []).length
          ? html`<p class="mt-4 text-sm font-semibold">Achievements</p>
              <ul class="mt-2 space-y-1">
                ${(byRole.get(r.id) ?? []).map((a) => html`<li><a href="/achievements/${a.id}">${a.title}</a></li>`)}
              </ul>`
          : ''}
      </li>`,
    )}
  </ol>`;
}

export function skillsList(b: CareerContentBundle): SafeHtml {
  const skills = skillById(b);
  return html`<div class="grid gap-8 sm:grid-cols-2">
    ${b.skillCategories.map(
      (c) => html`<section aria-labelledby="skills-${c.id}">
        <h3 id="skills-${c.id}" class="font-display text-xl font-bold">${c.name}</h3>
        <ul class="mt-4 space-y-3">
          ${c.skills.map((id) => {
            const s = skills.get(id);
            if (!s) return '';
            return html`<li id="${s.id}" class="flex items-center justify-between gap-4">
              <span>${s.name}</span>
              <span class="font-mono text-sm text-ink-muted" aria-label="Proficiency ${s.proficiency} of 5">${'●'.repeat(s.proficiency)}${'○'.repeat(5 - s.proficiency)}</span>
            </li>`;
          })}
        </ul>
      </section>`,
    )}
  </div>`;
}

export function hero(b: CareerContentBundle): SafeHtml {
  const p = b.profile;
  return html`<section id="top" class="bf-hero relative isolate overflow-hidden py-24 sm:py-32" aria-labelledby="hero-name">
    <div class="bf-hero-glow pointer-events-none absolute inset-0 -z-10" aria-hidden="true"></div>
    <p class="font-mono text-sm uppercase tracking-[0.25em] text-accent motion-safe:animate-fade">${p.headline}</p>
    <h1 id="hero-name" class="mt-4 font-display text-5xl font-bold motion-safe:animate-rise">${p.name}</h1>
    <p class="mt-6 max-w-2xl text-xl text-ink-muted sm:text-2xl">${p.valueStatement}</p>
    <div class="mt-10 flex flex-wrap gap-4">
      <a class="bf-cta inline-flex items-center rounded-pill bg-accent px-7 py-3.5 font-display text-lg font-semibold text-accent-ink no-underline shadow-md" href="/achievements">See my achievements</a>
      <a class="bf-cta inline-flex items-center rounded-pill bg-surface-raised px-7 py-3.5 font-display text-lg font-semibold text-ink no-underline ring-1 ring-border" href="#contact" data-contact-trigger>Get in touch</a>
    </div>
  </section>`;
}

/** The <main> content for a route. */
export function routeView(route: RouteMatch, b: CareerContentBundle): SafeHtml {
  switch (route.kind) {
    case 'home':
      return html`${hero(b)}
        <section id="achievements" class="py-20" aria-labelledby="achievements-heading">
          ${sectionHead('achievements-heading', 'Selected work', 'Achievements', 'Outcomes I delivered, with the evidence behind them.')}
          ${slot('achievements', achievementsList(b, { featuredOnly: true }))}
          <p class="mt-8"><a href="/achievements">See all achievements →</a></p>
        </section>
        <section id="timeline" class="py-20" aria-labelledby="timeline-heading">
          ${sectionHead('timeline-heading', 'Career', 'Timeline', 'The roles that shaped how I build software.')}
          ${slot('timeline', timelineList(b))}
        </section>
        <section id="skills" class="py-20" aria-labelledby="skills-heading">
          ${sectionHead('skills-heading', 'Toolbox', 'Skills', 'What I work with, and where I have proven it.')}
          ${slot('skills', skillsList(b))}
        </section>`;
    case 'achievements':
      return route.subPath
        ? html`<div class="py-16">${slot('achievements', achievementDetail(b, route.subPath))}</div>`
        : html`<div class="py-16">
            ${sectionHead('achievements-heading', 'Selected work', 'Achievements', 'Outcomes I delivered, with the evidence behind them.', 1)}
            ${slot('achievements', achievementsList(b))}
          </div>`;
    case 'timeline':
      return html`<div class="py-16">
        ${sectionHead('timeline-heading', 'Career', 'Timeline', 'The roles that shaped how I build software.', 1)}
        ${slot('timeline', timelineList(b))}
      </div>`;
    case 'skills':
      return html`<div class="py-16">
        ${sectionHead('skills-heading', 'Toolbox', 'Skills', 'What I work with, and where I have proven it.', 1)}
        ${slot('skills', skillsList(b))}
      </div>`;
    case 'patents': {
      const n = b.patents.length;
      return html`<div class="py-16">
        ${sectionHead('patents-heading', 'Inventions', 'Patents', `${n} issued U.S. patent${n === 1 ? '' : 's'}, each linked to its public record on Google Patents.`, 1)}
        ${patentsList(b)}
      </div>`;
    }
    case 'not-found':
      return notFound();
  }
}

export function notFound(): SafeHtml {
  return html`<div class="py-24">
    <p class="font-mono text-sm uppercase tracking-[0.2em] text-accent">404</p>
    <h1 class="mt-3 font-display text-4xl font-bold">Page not found</h1>
    <p class="mt-4 text-lg text-ink-muted">That page doesn’t exist, but plenty else does.</p>
    <p class="mt-8"><a class="inline-flex rounded-pill bg-accent px-6 py-3 font-semibold text-accent-ink no-underline" href="/">Back to the home page</a></p>
  </div>`;
}
