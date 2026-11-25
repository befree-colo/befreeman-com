import type { CareerContentBundle, Link } from '@befreeman/content';
import { html } from './html';
import type { SafeHtml } from './html';
import type { RouteMatch } from './routes';

const ICONS: Record<Link['kind'], string> = {
  linkedin: 'M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4V21H3zM9.5 9.75h3.8v1.6h.06c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.77 2.65 4.77 6.1V21h-4v-4.9c0-1.17-.02-2.68-1.63-2.68-1.64 0-1.89 1.28-1.89 2.6V21h-4z',
  github: 'M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a10.9 10.9 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z',
  // Simple Icons (CC0)
  bitbucket: 'M.778 1.213a.768.768 0 0 0-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 0 0 .77-.646l3.27-20.03a.768.768 0 0 0-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z',
  website: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-3a15.6 15.6 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8zM12 4c.8 1.2 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.8 1.9-4zM4.3 14a8 8 0 0 1 0-4h3.4a16.5 16.5 0 0 0 0 4zm.8 2h3a15.6 15.6 0 0 0 1.4 3.6A8 8 0 0 1 5.1 16zm3-8h-3a8 8 0 0 1 4.4-3.6A15.6 15.6 0 0 0 8.1 8zM12 20c-.8-1.2-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.8-1.9 4zm2.3-6H9.7a14.7 14.7 0 0 1 0-4h4.6a14.7 14.7 0 0 1 0 4zm.2 5.6a15.6 15.6 0 0 0 1.4-3.6h3a8 8 0 0 1-4.4 3.6zm1.8-5.6a16.5 16.5 0 0 0 0-4h3.4a8 8 0 0 1 0 4z',
  other: 'M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5',
};

/** Profile links (LinkedIn, GitHub, ...) as accessible icon+label links. Never includes email. */
export function contactLinks(b: CareerContentBundle): SafeHtml {
  return html`<ul class="flex flex-wrap gap-3">
    ${b.profile.links.map(
      (l) => html`<li>
        <a
          class="inline-flex items-center gap-2 rounded-pill bg-surface-raised px-4 py-2 text-ink no-underline ring-1 ring-border hover:ring-accent"
          href="${l.url}"
          rel="me noopener noreferrer"
          target="_blank"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="${ICONS[l.kind]}" /></svg>
          ${l.label}
        </a>
      </li>`,
    )}
  </ul>`;
}

/** Footer contact section; the email button is enhanced by the shell (decoded only on click). */
export function footer(b: CareerContentBundle): SafeHtml {
  return html`<div class="mx-auto max-w-6xl px-4 py-16 sm:px-6">
    <h2 class="font-display text-3xl font-bold">Let’s build something.</h2>
    <p class="mt-3 max-w-xl text-ink-muted">Hiring, consulting, or just want to compare notes on architecture? Reach out.</p>
    <div class="mt-6 flex flex-wrap items-center gap-3">
      ${b.profile.contactToken
        ? html`<button type="button" class="inline-flex items-center rounded-pill bg-accent px-5 py-2 font-semibold text-accent-ink" data-contact-trigger>Email me</button>`
        : ''}
      ${contactLinks(b)}
    </div>
    <p class="mt-12 text-sm text-ink-muted">© ${b.profile.name}. Built as runtime-composed micro frontends: Angular, React, Vue, and Svelte in one site.</p>
  </div>`;
}

export function pageTitle(route: RouteMatch, b: CareerContentBundle): string {
  const site = `${b.profile.name} · ${b.profile.headline}`;
  switch (route.kind) {
    case 'home':
      return site;
    case 'achievements': {
      if (!route.subPath) return `Achievements · ${b.profile.name}`;
      const a = b.achievements.find((x) => x.id === route.subPath);
      return a ? `${a.title} · ${b.profile.name}` : `Achievement not found · ${b.profile.name}`;
    }
    case 'timeline':
      return `Career timeline · ${b.profile.name}`;
    case 'skills':
      return `Skills · ${b.profile.name}`;
    case 'patents':
      return `Patents · ${b.profile.name}`;
    case 'not-found':
      return `Page not found · ${b.profile.name}`;
  }
}
