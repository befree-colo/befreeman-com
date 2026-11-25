const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape text for HTML element content and attribute values. */
export function esc(value: string | number | null | undefined): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}

/** Mark a string as already-safe HTML (trusted, e.g. markdown rendered at build time from the repo). */
export interface SafeHtml {
  readonly __html: string;
}
export const raw = (html: string): SafeHtml => ({ __html: html });

type Value = string | number | null | undefined | false | SafeHtml | Value[];

function render(v: Value): string {
  if (v === null || v === undefined || v === false) return '';
  if (Array.isArray(v)) return v.map(render).join('');
  if (typeof v === 'object') return v.__html;
  return esc(v);
}

/** Tagged template that escapes interpolations unless wrapped with `raw()` or nested `html`. */
export function html(strings: TemplateStringsArray, ...values: Value[]): SafeHtml {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < values.length) out += render(values[i] as Value);
  });
  return raw(out);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2021-06` → `Jun 2021`; null → `Present`. */
export function formatYearMonth(ym: string | null | undefined): string {
  if (!ym) return 'Present';
  const [y, m] = ym.split('-');
  return `${MONTHS[Number(m) - 1] ?? ''} ${y}`.trim();
}

/** `2026-01-20` → `Jan 20, 2026`. */
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${MONTHS[Number(m) - 1] ?? ''} ${Number(d)}, ${y}`;
}
