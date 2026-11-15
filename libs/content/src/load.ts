import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { marked } from 'marked';
import { parse as parseYaml } from 'yaml';
import type { z } from 'zod';
import { encodeContact } from './obfuscate';
import {
  achievementSchema,
  caseStudySchema,
  profileSchema,
  roleSchema,
  skillsFileSchema,
} from './schema';
import type { Achievement, CaseStudy, Profile, Role, Skill, SkillCategory } from './schema';
import { ContentValidationError, sourceKey, validateReferences } from './validate';
import type { ContentIssue, SourceMap, UnversionedBundle } from './validate';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export interface MarkdownDoc {
  data: unknown;
  body: string;
}

export function parseMarkdown(source: string): MarkdownDoc {
  const match = FRONTMATTER.exec(source);
  if (!match) return { data: {}, body: source };
  return { data: parseYaml(match[1] ?? '') ?? {}, body: (match[2] ?? '').trim() };
}

export function renderMarkdown(body: string): string {
  return body ? (marked.parse(body, { async: false, gfm: true }) as string).trim() : '';
}

async function listMarkdown(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).filter((f) => f.endsWith('.md')).sort().map((f) => join(dir, f));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

export interface LoadResult {
  content: UnversionedBundle;
  sources: SourceMap;
}

/**
 * Reads and validates the content directory:
 *   profile.md, roles/*.md, achievements/*.md, case-studies/*.md, skills.yaml
 * Throws ContentValidationError listing every problem found.
 */
export async function loadContent(contentDir: string): Promise<LoadResult> {
  const issues: ContentIssue[] = [];
  const sources: SourceMap = new Map();
  const rel = (file: string) => relative(contentDir, file);

  function check<S extends z.ZodType>(schema: S, data: unknown, file: string, fallbackId: string): z.infer<S> | null {
    const result = schema.safeParse(data);
    if (result.success) return result.data;
    for (const issue of result.error.issues) {
      issues.push({
        file: rel(file),
        entity: fallbackId,
        message: `${issue.path.length ? issue.path.join('.') + ': ' : ''}${issue.message}`,
      });
    }
    return null;
  }

  // Profile
  const profilePath = join(contentDir, 'profile.md');
  let profile: Profile | null = null;
  try {
    const doc = parseMarkdown(await readFile(profilePath, 'utf8'));
    const parsed = check(profileSchema, doc.data, profilePath, 'profile');
    if (parsed) {
      const { email, ...rest } = parsed;
      profile = { ...rest, summaryHtml: renderMarkdown(doc.body), contactToken: email ? encodeContact(email) : null };
      sources.set(sourceKey('profile', 'profile'), rel(profilePath));
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    issues.push({ file: 'profile.md', entity: 'profile', message: 'profile.md is required' });
  }

  async function loadDocs<S extends z.ZodType, T>(
    folder: string,
    type: 'role' | 'achievement' | 'caseStudy',
    schema: S,
    finish: (parsed: z.infer<S>, bodyHtml: string) => T,
  ): Promise<T[]> {
    const out: T[] = [];
    for (const file of await listMarkdown(join(contentDir, folder))) {
      const doc = parseMarkdown(await readFile(file, 'utf8'));
      const fileId = file.replace(/^.*[\\/]/, '').replace(/\.md$/, '');
      const data = { id: fileId, ...(doc.data as object) };
      const parsed = check(schema, data, file, `${type}:${fileId}`);
      if (!parsed) continue;
      const id = (parsed as unknown as { id: string }).id;
      if (!sources.has(sourceKey(type, id))) sources.set(sourceKey(type, id), rel(file));
      out.push(finish(parsed, renderMarkdown(doc.body)));
    }
    return out;
  }

  const roles = await loadDocs('roles', 'role', roleSchema, (r, bodyHtml): Role => ({ ...r, bodyHtml }));
  const achievements = await loadDocs(
    'achievements',
    'achievement',
    achievementSchema,
    (a, bodyHtml): Achievement => ({ ...a, bodyHtml }),
  );
  const caseStudies = await loadDocs(
    'case-studies',
    'caseStudy',
    caseStudySchema,
    (c, bodyHtml): CaseStudy => ({ ...c, bodyHtml }),
  );

  // Skills
  const skillsPath = join(contentDir, 'skills.yaml');
  const skills: Skill[] = [];
  const skillCategories: SkillCategory[] = [];
  try {
    const parsed = check(skillsFileSchema, parseYaml(await readFile(skillsPath, 'utf8')), skillsPath, 'skills');
    for (const category of parsed?.categories ?? []) {
      skillCategories.push({ id: category.id, name: category.name, skills: category.skills.map((s) => s.id) });
      for (const skill of category.skills) {
        skills.push({ ...skill, category: category.id });
        if (!sources.has(sourceKey('skill', skill.id))) sources.set(sourceKey('skill', skill.id), rel(skillsPath));
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    issues.push({ file: 'skills.yaml', entity: 'skills', message: 'skills.yaml is required' });
  }

  if (!profile) {
    throw new ContentValidationError(issues);
  }

  const newestFirst = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);
  // Achievements without a date sort by their role's start (stable, so file order breaks ties).
  const roleStart = new Map(roles.map((r) => [r.id, r.start]));
  const when = (a: Achievement) => a.date ?? roleStart.get(a.role) ?? '';
  const content: UnversionedBundle = {
    profile,
    roles: roles.sort((a, b) => newestFirst(a.start, b.start)),
    achievements: achievements.sort((a, b) => newestFirst(when(a), when(b))),
    caseStudies,
    skills,
    skillCategories,
  };
  issues.push(...validateReferences(content, sources));
  if (issues.length) throw new ContentValidationError(issues);
  return { content, sources };
}
