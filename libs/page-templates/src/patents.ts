import type { CareerContentBundle } from '@befreeman/content';
import { formatDate, html } from './html';
import type { SafeHtml } from './html';

/** `US12530268B2` → `US 12,530,268 B2`. */
export function patentNumber(number: string): string {
  const m = /^([A-Z]{2})(\d+)([A-Z]\d?)$/.exec(number);
  if (!m) return number;
  const [, country, digits, kind] = m;
  return `${country} ${Number(digits).toLocaleString('en-US')} ${kind}`;
}

/** The patent's public record on Google Patents. */
export function patentUrl(number: string): string {
  return `https://patents.google.com/patent/${encodeURIComponent(number)}/en`;
}

/** Every patent, newest first, each linked to its Google Patents record. */
export function patentsList(b: CareerContentBundle): SafeHtml {
  const roles = new Map(b.roles.map((r) => [r.id, r]));
  return html`<ol class="grid gap-6">
    ${b.patents.map((p) => {
      const role = p.role ? roles.get(p.role) : undefined;
      return html`<li id="${p.id}" class="rounded-lg bg-surface-raised p-6 shadow-md ring-1 ring-border">
        <h2 class="font-display text-xl font-bold">
          <a href="${patentUrl(p.number)}" target="_blank" rel="noopener noreferrer">${p.title}<span class="sr-only"> (opens Google Patents in a new tab)</span></a>
        </h2>
        <p class="mt-2 font-mono text-sm text-ink-muted">
          ${patentNumber(p.number)} · <time datetime="${p.issued}">${formatDate(p.issued)}</time> · ${p.assignee}
        </p>
        <p class="mt-3">${p.summary}</p>
        ${role ? html`<p class="mt-3 text-sm"><a href="/timeline#${role.id}">${role.title} · ${role.company}</a></p>` : ''}
      </li>`;
    })}
  </ol>`;
}
