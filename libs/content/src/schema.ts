import { z } from 'zod';

/** Stable, URL-safe identifier: lowercase letters, digits, and single hyphens. */
export const idSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a URL-safe slug (lowercase letters, digits, hyphens)')
  .max(80);

/** Year-month, e.g. `2021-04`. */
export const yearMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'must be YYYY-MM');

/** Calendar date, e.g. `2026-01-20`. */
export const dateSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'must be YYYY-MM-DD');

/** U.S. publication number: country code, 7–8 digits, kind code, e.g. `US12530268B2`. */
export const patentNumberSchema = z
  .string()
  .regex(/^US\d{7,8}[AB]\d$/, 'must be a U.S. publication number such as US12530268B2');

const placeholder = z.boolean().default(false);

export const linkSchema = z.object({
  label: z.string().min(1),
  url: z.url(),
  kind: z.enum(['linkedin', 'github', 'bitbucket', 'website', 'other']),
});

export const profileSchema = z.object({
  id: z.literal('profile').default('profile'),
  name: z.string().min(1),
  headline: z.string().min(1),
  valueStatement: z.string().min(1),
  location: z.string().optional(),
  /** Only used to build an obfuscated contact path; never emitted in plain text. */
  email: z.email().optional(),
  links: z.array(linkSchema).default([]),
  placeholder,
});

export const roleSchema = z
  .object({
    id: idSchema,
    company: z.string().min(1),
    title: z.string().min(1),
    start: yearMonthSchema,
    end: yearMonthSchema.nullable().default(null),
    location: z.string().optional(),
    summary: z.string().min(1),
    responsibilities: z.array(z.string().min(1)).min(1),
    placeholder,
  })
  .refine((r) => r.end === null || r.end >= r.start, { message: 'end must not be before start', path: ['end'] });

export const metricSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});

export const achievementSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  /** Role this achievement was earned in. */
  role: idSchema,
  /** Skill ids for the technologies involved. */
  skills: z.array(idSchema).min(1, 'at least one technology is required'),
  impact: z.array(z.string().min(1)).min(1, 'at least one impact statement is required'),
  metrics: z.array(metricSchema).optional(),
  caseStudy: idSchema.optional(),
  featured: z.boolean().default(false),
  date: yearMonthSchema.optional(),
  placeholder,
});

export const caseStudySchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  role: idSchema,
  achievements: z.array(idSchema).min(1),
  placeholder,
});

export const patentSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  number: patentNumberSchema,
  issued: dateSchema,
  /** Company the invention was made for, e.g. `Dell`. */
  assignee: z.string().min(1),
  summary: z.string().min(1),
  /** Role the invention was made in. */
  role: idSchema.optional(),
  placeholder,
});

export const skillSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  /** Relative proficiency, 1 (familiar) to 5 (expert). */
  proficiency: z.number().int().min(1).max(5),
  years: z.number().int().min(0).optional(),
  placeholder,
});

export const skillCategorySchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  skills: z.array(skillSchema).min(1),
});

export const skillsFileSchema = z.object({
  categories: z.array(skillCategorySchema).min(1),
});

export type Link = z.infer<typeof linkSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type Role = z.infer<typeof roleSchema> & { bodyHtml: string };
export type Metric = z.infer<typeof metricSchema>;
export type Achievement = z.infer<typeof achievementSchema> & { bodyHtml: string };
export type CaseStudy = z.infer<typeof caseStudySchema> & { bodyHtml: string };
export type Patent = z.infer<typeof patentSchema>;
export type Skill = z.infer<typeof skillSchema> & { category: string };
export type SkillCategory = { id: string; name: string; skills: string[] };

/** Public profile, as published: the raw email is replaced by an obfuscated token. */
export type Profile = Omit<ProfileInput, 'email'> & { summaryHtml: string; contactToken: string | null };

export type EntityType = 'profile' | 'role' | 'achievement' | 'caseStudy' | 'skill' | 'patent';

export interface PlaceholderReport {
  total: number;
  byType: Record<EntityType, number>;
}

/** The single versioned bundle every consumer reads. */
export interface CareerContentBundle {
  /** Content hash; also part of the published file name. */
  version: string;
  profile: Profile;
  /** Newest first. */
  roles: Role[];
  achievements: Achievement[];
  caseStudies: CaseStudy[];
  skills: Skill[];
  skillCategories: SkillCategory[];
  /** Newest issue date first. */
  patents: Patent[];
  placeholders: PlaceholderReport;
}
