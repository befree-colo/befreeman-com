import type { CareerContentBundle, EntityType, PlaceholderReport } from './schema';

export interface ContentIssue {
  /** Where the problem is, e.g. `achievements/cloud-migration.md`. */
  file: string;
  entity: string;
  message: string;
}

export class ContentValidationError extends Error {
  constructor(readonly issues: ContentIssue[]) {
    super(
      `Career content is invalid (${issues.length} issue${issues.length === 1 ? '' : 's'}):\n` +
        issues.map((i) => `  - ${i.file} [${i.entity}]: ${i.message}`).join('\n'),
    );
    this.name = 'ContentValidationError';
  }
}

/** Bundle fields minus the computed version, as produced by the loader. */
export type UnversionedBundle = Omit<CareerContentBundle, 'version' | 'placeholders'>;

/** Source file for each entity, used in error messages. */
export type SourceMap = Map<string, string>;

export const sourceKey = (type: EntityType, id: string) => `${type}:${id}`;

/**
 * Cross-entity checks the per-entity schemas cannot express:
 * unique ids within each type and every reference resolving to exactly one entity.
 */
export function validateReferences(content: UnversionedBundle, sources: SourceMap = new Map()): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const where = (type: EntityType, id: string) => sources.get(sourceKey(type, id)) ?? `${type}/${id}`;

  const index = <T extends { id: string }>(type: EntityType, items: T[]) => {
    const seen = new Map<string, T>();
    for (const item of items) {
      if (seen.has(item.id)) {
        issues.push({ file: where(type, item.id), entity: `${type}:${item.id}`, message: `duplicate ${type} id "${item.id}"` });
      } else {
        seen.set(item.id, item);
      }
    }
    return seen;
  };

  const roles = index('role', content.roles);
  const achievements = index('achievement', content.achievements);
  const caseStudies = index('caseStudy', content.caseStudies);
  const skills = index('skill', content.skills);

  const ref = (type: EntityType, id: string, field: string, target: Map<string, unknown>, targetType: EntityType, value: string) => {
    if (!target.has(value)) {
      issues.push({
        file: where(type, id),
        entity: `${type}:${id}`,
        message: `${field} references missing ${targetType} id "${value}"`,
      });
    }
  };

  for (const a of content.achievements) {
    ref('achievement', a.id, 'role', roles, 'role', a.role);
    for (const s of a.skills) ref('achievement', a.id, 'skills', skills, 'skill', s);
    if (a.caseStudy) ref('achievement', a.id, 'caseStudy', caseStudies, 'caseStudy', a.caseStudy);
  }
  index('patent', content.patents);
  const byNumber = new Map<string, string[]>();
  for (const p of content.patents) byNumber.set(p.number, [...(byNumber.get(p.number) ?? []), p.id]);
  for (const [number, ids] of byNumber) {
    if (ids.length < 2) continue;
    for (const id of ids) {
      const others = ids.filter((x) => x !== id).map((x) => `"${x}"`).join(', ');
      issues.push({
        file: where('patent', id),
        entity: `patent:${id}`,
        message: `publication number ${number} is also used by patent ${others}`,
      });
    }
  }
  for (const p of content.patents) {
    if (p.role) ref('patent', p.id, 'role', roles, 'role', p.role);
  }
  for (const c of content.caseStudies) {
    ref('caseStudy', c.id, 'role', roles, 'role', c.role);
    for (const a of c.achievements) ref('caseStudy', c.id, 'achievements', achievements, 'achievement', a);
  }
  return issues;
}

export function countPlaceholders(content: UnversionedBundle): PlaceholderReport {
  const byType: Record<EntityType, number> = {
    profile: content.profile.placeholder ? 1 : 0,
    role: content.roles.filter((r) => r.placeholder).length,
    achievement: content.achievements.filter((a) => a.placeholder).length,
    caseStudy: content.caseStudies.filter((c) => c.placeholder).length,
    skill: content.skills.filter((s) => s.placeholder).length,
    patent: content.patents.filter((p) => p.placeholder).length,
  };
  return { total: Object.values(byType).reduce((a, b) => a + b, 0), byType };
}

export function formatPlaceholderWarning(report: PlaceholderReport): string | null {
  if (report.total === 0) return null;
  const parts = (Object.entries(report.byType) as [EntityType, number][])
    .filter(([, n]) => n > 0)
    .map(([type, n]) => `${type}: ${n}`);
  return `⚠ ${report.total} placeholder content entit${report.total === 1 ? 'y' : 'ies'} remain (${parts.join(', ')}). Replace them before launch.`;
}
