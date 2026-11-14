import type { CareerContentBundle, EntityType } from './schema';

/** A retrieval unit for the future career agent. Every chunk cites one entity. */
export interface CorpusChunk {
  /** Unique chunk id, e.g. `achievement:cloud-migration#1`. */
  id: string;
  entity: { type: EntityType; id: string };
  title: string;
  text: string;
  /** Site path where the entity is shown, for citations and navigation. */
  url: string;
}

const stripHtml = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/** Split long text on paragraph/sentence boundaries into pieces of at most `max` characters. */
export function splitText(text: string, max = 800): string[] {
  const clean = text.trim();
  if (clean.length <= max) return clean ? [clean] : [];
  const sentences = clean.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [clean];
  const out: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if ((current + sentence).length > max && current) {
      out.push(current.trim());
      current = '';
    }
    if (sentence.length > max) {
      for (let i = 0; i < sentence.length; i += max) out.push(sentence.slice(i, i + max).trim());
    } else {
      current += sentence;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/**
 * Flatten the bundle into citeable chunks. Implemented and tested here;
 * consumed by the career agent in a later change.
 */
export function toCorpus(bundle: CareerContentBundle, maxChunk = 800): CorpusChunk[] {
  const chunks: CorpusChunk[] = [];
  const skillName = new Map(bundle.skills.map((s) => [s.id, s.name]));
  const roleLabel = new Map(bundle.roles.map((r) => [r.id, `${r.title} at ${r.company}`]));

  const push = (type: EntityType, id: string, title: string, url: string, parts: (string | undefined)[]) => {
    const text = parts.filter((p): p is string => !!p && p.trim().length > 0).join('\n');
    splitText(text, maxChunk).forEach((piece, i) => {
      chunks.push({ id: `${type}:${id}#${i + 1}`, entity: { type, id }, title, text: piece, url });
    });
  };

  const p = bundle.profile;
  push('profile', 'profile', p.name, '/', [p.headline, p.valueStatement, p.location, stripHtml(p.summaryHtml)]);

  for (const r of bundle.roles) {
    push('role', r.id, `${r.title} at ${r.company}`, `/timeline#${r.id}`, [
      `${r.title} at ${r.company} (${r.start} to ${r.end ?? 'present'}).`,
      r.summary,
      r.responsibilities.join('. ') + '.',
      stripHtml(r.bodyHtml),
    ]);
  }
  for (const a of bundle.achievements) {
    push('achievement', a.id, a.title, `/achievements/${a.id}`, [
      `${a.title} (${roleLabel.get(a.role) ?? a.role}).`,
      a.summary,
      `Impact: ${a.impact.join('; ')}.`,
      a.metrics?.length ? `Metrics: ${a.metrics.map((m) => `${m.label} ${m.value}`).join('; ')}.` : undefined,
      `Technologies: ${a.skills.map((s) => skillName.get(s) ?? s).join(', ')}.`,
      stripHtml(a.bodyHtml),
    ]);
  }
  for (const c of bundle.caseStudies) {
    push('caseStudy', c.id, c.title, `/achievements/${c.achievements[0] ?? ''}#case-study`, [
      c.title + '.',
      c.summary,
      stripHtml(c.bodyHtml),
    ]);
  }
  for (const s of bundle.skills) {
    const demonstrated = bundle.achievements.filter((a) => a.skills.includes(s.id)).map((a) => a.title);
    push('skill', s.id, s.name, `/skills#${s.id}`, [
      `${s.name}: proficiency ${s.proficiency}/5${s.years !== undefined ? `, ${s.years} years` : ''}.`,
      demonstrated.length ? `Demonstrated in: ${demonstrated.join('; ')}.` : undefined,
    ]);
  }
  return chunks;
}
