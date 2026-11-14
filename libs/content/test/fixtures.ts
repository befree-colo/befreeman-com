import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export type FixtureFiles = Record<string, string>;

export const validFiles = (): FixtureFiles => ({
  'profile.md': `---
name: Test Person
headline: Software Architect
valueStatement: I build systems that last.
email: test@example.com
links:
  - { label: LinkedIn, url: "https://www.linkedin.com/in/test", kind: linkedin }
---
Summary **paragraph**.
`,
  'roles/acme.md': `---
company: Acme
title: Principal Architect
start: 2021-03
summary: Led architecture.
responsibilities: [Own the platform roadmap]
---
Role body.
`,
  'roles/globex.md': `---
company: Globex
title: Senior Engineer
start: 2017-01
end: 2021-02
summary: Built things.
responsibilities: [Ship services]
---
`,
  'achievements/cloud-migration.md': `---
title: Cloud migration
summary: Moved everything.
role: acme
skills: [aws, typescript]
impact: [Cut cost 30%]
metrics: [{ label: Cost, value: "-30%" }]
caseStudy: platform-rebuild
---
Details.
`,
  'achievements/ci-speedup.md': `---
title: CI speedup
summary: Faster builds.
role: globex
skills: [typescript]
impact: [Builds 4x faster]
---
`,
  'case-studies/platform-rebuild.md': `---
title: Platform rebuild
summary: The story.
role: acme
achievements: [cloud-migration]
---
## Problem
It was slow.
`,
  'skills.yaml': `categories:
  - id: cloud
    name: Cloud
    skills:
      - { id: aws, name: AWS, proficiency: 5, years: 8 }
  - id: languages
    name: Languages
    skills:
      - { id: typescript, name: TypeScript, proficiency: 5 }
`,
});

export async function writeFixture(files: FixtureFiles): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), 'bf-content-'));
  for (const [path, body] of Object.entries(files)) {
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await writeFile(join(dir, path), body);
  }
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}
