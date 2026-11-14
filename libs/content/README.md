# @befreeman/content

The single source of truth for career content. The shell, every remote, the pre-renderer, and the future career agent all read the **same validated, versioned bundle**, so they always show the same facts.

```bash
pnpm nx run content:validate   # check content, print placeholder warning
pnpm nx run content:bundle     # validate + write dist/libs/content/content.<hash>.json
pnpm nx test content           # unit tests
```

Every app build depends on `content:bundle`, so invalid content **fails the build**. The error names the file, the entity, and the problem.

## Where content lives

```
libs/content/content/
  profile.md               # exactly one
  roles/<role-id>.md       # one file per job
  achievements/<id>.md     # one file per achievement
  case-studies/<id>.md     # optional long-form stories
  skills.yaml              # skill categories and skills
```

Each Markdown file has YAML **frontmatter** between `---` lines, followed by an optional Markdown **body** (rendered to HTML in the bundle).

**IDs** are URL-safe slugs: lowercase letters, digits, and single hyphens, e.g. `cloud-migration`. For roles, achievements, and case studies the ID is the **file name** without `.md`; you can override it with an `id:` field, but avoid doing so. IDs appear in URLs (`/achievements/<id>`) and are how entities reference each other, so treat them as permanent once published.

Dates are `YYYY-MM`.

## Fields

### `profile.md`

| Field | Required | Notes |
|---|---|---|
| `name`, `headline`, `valueStatement` | yes | shown in the hero |
| `location` | no | |
| `email` | no | **never published in plain text**; the bundle only contains an obfuscated token used by the contact button |
| `links` | no | list of `{ label, url, kind }`; `kind` is `linkedin`, `github`, `bitbucket`, `website`, or `other` |
| body | no | your longer summary |

### `roles/<id>.md`

| Field | Required | Notes |
|---|---|---|
| `company`, `title`, `summary` | yes | |
| `start` | yes | `YYYY-MM` |
| `end` | no | `YYYY-MM`; omit for your current role |
| `responsibilities` | yes | list, at least one |
| `location` | no | |
| body | no | narrative for the timeline's expanded view |

### `achievements/<id>.md`

| Field | Required | Notes |
|---|---|---|
| `title`, `summary` | yes | |
| `role` | yes | ID of the role it was earned in |
| `skills` | yes | list of skill IDs from `skills.yaml` (the technologies involved), at least one |
| `impact` | yes | list of outcome statements, **at least one**; this is the evidence that sells |
| `metrics` | no | list of `{ label, value }`, e.g. `{ label: Deploy time, value: "2h → 10m" }` |
| `caseStudy` | no | ID of a case study |
| `featured` | no | `true` to promote it on the home page |
| `date` | no | `YYYY-MM` |
| body | no | the longer story |

### `case-studies/<id>.md`

| Field | Required | Notes |
|---|---|---|
| `title`, `summary` | yes | |
| `role` | yes | role ID |
| `achievements` | yes | list of achievement IDs it tells the story of |
| body | recommended | use `## Problem`, `## Approach`, `## Outcome` headings |

### `skills.yaml`

```yaml
categories:
  - id: cloud
    name: Cloud & Platform
    skills:
      - { id: aws, name: AWS, proficiency: 4, years: 8 }
```

`proficiency` is an integer from 1 (familiar) to 5 (expert). Skill IDs must be unique across all categories.

## Validation rules

The build fails when:
- a field is missing or malformed (see the tables above);
- two entities of the same type share an ID;
- a reference (`role`, `skills`, `caseStudy`, `achievements`) points to an ID that does not exist;
- an achievement has no impact statement.

## Replacing placeholders

Any entity that still holds stand-in text has `placeholder: true`, and each production build counts them:

```
⚠ 2 placeholder content entities remain (profile: 1, caseStudy: 1). Replace them before launch.
```

To replace one, edit the file with your real details and **delete the `placeholder: true` line**. To remove an entity, delete its file and any references to it. The validator will tell you if something still points at it. When the warning disappears, the content is launch-ready.

## Example: adding an achievement

Create `libs/content/content/achievements/zero-downtime-db-upgrade.md`:

```markdown
---
title: Zero-downtime database upgrade
summary: Upgraded the primary Postgres cluster across two major versions with no customer-visible downtime.
role: liveperson-principal-engineer
skills: [postgresql]
impact:
  - Completed the upgrade with zero downtime and no data loss
metrics:
  - { label: Downtime, value: "0 min" }
date: 2024-06
---
We used logical replication to a new cluster, dual-read verification, and a scripted cutover.
```

Then run `pnpm nx run content:validate`.

## Programmatic use

```ts
import type { CareerContentBundle } from '@befreeman/content';
import { toCorpus, decodeContact } from '@befreeman/content';   // browser-safe
import { buildBundle, writeBundle } from '@befreeman/content/node'; // Node only (fs)
```

`toCorpus(bundle)` turns the bundle into citeable chunks (`{ id, entity: { type, id }, title, text, url }`) for the career agent.
