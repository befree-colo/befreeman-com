import { afterEach, describe, expect, it } from 'vitest';
import { validFiles, writeFixture } from '../test/fixtures';
import type { FixtureFiles } from '../test/fixtures';
import { loadContent, parseMarkdown } from './load';
import { decodeContact } from './obfuscate';
import { ContentValidationError, countPlaceholders, formatPlaceholderWarning } from './validate';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((c) => c()));
});

async function load(files: FixtureFiles) {
  const { dir, cleanup } = await writeFixture(files);
  cleanups.push(cleanup);
  return loadContent(dir);
}

async function issuesFor(files: FixtureFiles): Promise<string[]> {
  try {
    await load(files);
  } catch (error) {
    if (error instanceof ContentValidationError) return error.issues.map((i) => `${i.file} [${i.entity}]: ${i.message}`);
    throw error;
  }
  return [];
}

describe('loadContent', () => {
  it('loads valid content, sorts roles newest first, and renders markdown', async () => {
    const { content } = await load(validFiles());
    expect(content.roles.map((r) => r.id)).toEqual(['acme', 'globex']);
    expect(content.roles[1]?.end).toBe('2021-02');
    expect(content.profile.summaryHtml).toBe('<p>Summary <strong>paragraph</strong>.</p>');
    expect(content.caseStudies[0]?.bodyHtml).toContain('<h2>Problem</h2>');
    expect(content.skills.map((s) => [s.id, s.category])).toEqual([
      ['aws', 'cloud'],
      ['typescript', 'languages'],
    ]);
    expect(content.skillCategories).toEqual([
      { id: 'cloud', name: 'Cloud', skills: ['aws'] },
      { id: 'languages', name: 'Languages', skills: ['typescript'] },
    ]);
  });

  it('never exposes the raw email, only a reversible token', async () => {
    const { content } = await load(validFiles());
    const json = JSON.stringify(content);
    expect(json).not.toContain('test@example.com');
    expect(content.profile.contactToken).not.toBeNull();
    expect(decodeContact(content.profile.contactToken ?? '')).toBe('test@example.com');
  });

  it('fails on a dangling reference, naming the achievement and the missing role', async () => {
    const files = validFiles();
    files['achievements/ci-speedup.md'] = files['achievements/ci-speedup.md']!.replace('role: globex', 'role: initech');
    expect(await issuesFor(files)).toEqual([
      'achievements/ci-speedup.md [achievement:ci-speedup]: role references missing role id "initech"',
    ]);
  });

  it('fails on dangling skill, case-study, and achievement references', async () => {
    const files = validFiles();
    files['achievements/ci-speedup.md'] = files['achievements/ci-speedup.md']!.replace(
      'skills: [typescript]',
      'skills: [rust]\ncaseStudy: nope',
    );
    files['case-studies/platform-rebuild.md'] = files['case-studies/platform-rebuild.md']!.replace(
      '[cloud-migration]',
      '[cloud-migration, ghost]',
    );
    const issues = await issuesFor(files);
    expect(issues).toHaveLength(3);
    expect(issues.join('\n')).toMatch(/skills references missing skill id "rust"/);
    expect(issues.join('\n')).toMatch(/caseStudy references missing caseStudy id "nope"/);
    expect(issues.join('\n')).toMatch(/achievements references missing achievement id "ghost"/);
  });

  it('fails on a duplicate id', async () => {
    const files = validFiles();
    files['achievements/ci-speedup-copy.md'] = files['achievements/ci-speedup.md']!.replace(
      '---\ntitle',
      '---\nid: ci-speedup\ntitle',
    );
    const issues = await issuesFor(files);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/duplicate achievement id "ci-speedup"/);
  });

  it('fails on a duplicate skill id across categories', async () => {
    const files = validFiles();
    files['skills.yaml'] += `  - id: more\n    name: More\n    skills:\n      - { id: aws, name: AWS again, proficiency: 2 }\n`;
    expect((await issuesFor(files)).join('\n')).toMatch(/duplicate skill id "aws"/);
  });

  it('fails on a missing impact statement, naming the achievement', async () => {
    const files = validFiles();
    files['achievements/ci-speedup.md'] = files['achievements/ci-speedup.md']!.replace('impact: [Builds 4x faster]', 'impact: []');
    const issues = await issuesFor(files);
    expect(issues).toEqual([
      'achievements/ci-speedup.md [achievement:ci-speedup]: impact: at least one impact statement is required',
    ]);
  });

  it('reports every problem at once', async () => {
    const files = validFiles();
    files['achievements/ci-speedup.md'] = files['achievements/ci-speedup.md']!.replace('impact: [Builds 4x faster]', 'impact: []');
    files['achievements/cloud-migration.md'] = files['achievements/cloud-migration.md']!.replace('role: acme', 'role: nobody');
    expect(await issuesFor(files)).toHaveLength(2);
  });

  it('requires profile.md and skills.yaml', async () => {
    const files = validFiles();
    delete files['profile.md'];
    delete files['skills.yaml'];
    const issues = await issuesFor(files);
    expect(issues.join('\n')).toMatch(/profile.md is required/);
  });

  it('counts placeholders by type and formats a warning', async () => {
    const files = validFiles();
    files['roles/acme.md'] = files['roles/acme.md']!.replace('company: Acme', 'company: Acme\nplaceholder: true');
    files['skills.yaml'] = files['skills.yaml']!.replace('proficiency: 5, years: 8', 'proficiency: 5, years: 8, placeholder: true');
    const { content } = await load(files);
    const report = countPlaceholders(content);
    expect(report).toEqual({ total: 2, byType: { profile: 0, role: 1, achievement: 0, caseStudy: 0, skill: 1 } });
    expect(formatPlaceholderWarning(report)).toBe(
      '⚠ 2 placeholder content entities remain (role: 1, skill: 1). Replace them before launch.',
    );
    expect(formatPlaceholderWarning({ total: 0, byType: report.byType })).toBeNull();
  });
});

describe('parseMarkdown', () => {
  it('separates frontmatter from body', () => {
    expect(parseMarkdown('---\na: 1\n---\nbody')).toEqual({ data: { a: 1 }, body: 'body' });
    expect(parseMarkdown('no frontmatter')).toEqual({ data: {}, body: 'no frontmatter' });
  });
});
