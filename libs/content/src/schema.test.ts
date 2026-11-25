import { describe, expect, it } from 'vitest';
import { achievementSchema, idSchema, patentSchema, profileSchema, roleSchema, skillsFileSchema } from './schema';

const achievement = {
  id: 'cloud-migration',
  title: 'Led cloud migration',
  summary: 'Moved 40 services to the cloud.',
  role: 'acme-architect',
  skills: ['aws'],
  impact: ['Cut infrastructure cost by 30%'],
};

const patent = {
  id: 'us12530268b2',
  title: 'Self-healing for data protection systems',
  number: 'US12530268B2',
  issued: '2026-01-20',
  assignee: 'Dell',
  summary: 'Records and replays fixes.',
};

describe('content schemas', () => {
  it.each(['a', 'cloud-migration', 'k8s-2024'])('accepts URL-safe id %s', (id) => {
    expect(idSchema.safeParse(id).success).toBe(true);
  });

  it.each(['Cloud', 'has space', 'trailing-', '-leading', 'double--hyphen', 'ünï'])('rejects id %s', (id) => {
    expect(idSchema.safeParse(id).success).toBe(false);
  });

  it('requires at least one impact statement on achievements', () => {
    const result = achievementSchema.safeParse({ ...achievement, impact: [] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/impact statement/);
  });

  it('treats metrics as optional and defaults flags', () => {
    const parsed = achievementSchema.parse(achievement);
    expect(parsed.metrics).toBeUndefined();
    expect(parsed.placeholder).toBe(false);
    expect(parsed.featured).toBe(false);
    expect(
      achievementSchema.safeParse({ ...achievement, metrics: [{ label: 'Cost', value: '-30%' }] }).success,
    ).toBe(true);
  });

  it('requires at least one technology on achievements', () => {
    expect(achievementSchema.safeParse({ ...achievement, skills: [] }).success).toBe(false);
  });

  it('rejects roles that end before they start', () => {
    const role = {
      id: 'acme',
      company: 'Acme',
      title: 'Architect',
      start: '2022-05',
      end: '2021-01',
      summary: 's',
      responsibilities: ['r'],
    };
    expect(roleSchema.safeParse(role).success).toBe(false);
    expect(roleSchema.parse({ ...role, end: null }).end).toBeNull();
  });

  it('validates profile links and email', () => {
    expect(profileSchema.safeParse({ name: 'N', headline: 'H', valueStatement: 'V', email: 'nope' }).success).toBe(
      false,
    );
    expect(
      profileSchema.parse({
        name: 'N',
        headline: 'H',
        valueStatement: 'V',
        links: [{ label: 'LinkedIn', url: 'https://linkedin.com/in/x', kind: 'linkedin' }],
      }).id,
    ).toBe('profile');
  });

  it('bounds skill proficiency to 1..5', () => {
    const file = (proficiency: number) => ({
      categories: [{ id: 'cloud', name: 'Cloud', skills: [{ id: 'aws', name: 'AWS', proficiency }] }],
    });
    expect(skillsFileSchema.safeParse(file(5)).success).toBe(true);
    expect(skillsFileSchema.safeParse(file(0)).success).toBe(false);
    expect(skillsFileSchema.safeParse(file(6)).success).toBe(false);
  });

  it('accepts a valid patent with an optional role', () => {
    const parsed = patentSchema.parse(patent);
    expect(parsed.role).toBeUndefined();
    expect(parsed.placeholder).toBe(false);
    expect(patentSchema.safeParse({ ...patent, role: 'acme' }).success).toBe(true);
    expect(patentSchema.safeParse({ ...patent, number: 'US8218532B1' }).success).toBe(true);
  });

  it.each(['12530268', 'US12530268', '12530268B2', 'us12530268b2', 'US 12,530,268 B2', 'EP1234567B1'])(
    'rejects malformed patent number %s',
    (number) => {
      const result = patentSchema.safeParse({ ...patent, number });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toMatch(/U\.S\. publication number/);
    },
  );

  it.each(['2026-01', '2026-13-01', '2026-01-32', 'Jan 20, 2026'])('rejects patent issue date %s', (issued) => {
    expect(patentSchema.safeParse({ ...patent, issued }).success).toBe(false);
  });
});
