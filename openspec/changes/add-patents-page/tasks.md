# Tasks

## 1. Patent content model

- [x] 1.1 Add `patentSchema` (`id`, `title`, `number` matching `^US\d{7,8}[AB]\d$`, `issued` as `YYYY-MM-DD`, `assignee`, `summary`, optional `role`, `placeholder`) and a full-date schema to `libs/content/src/schema.ts`. Add `patents` (newest first) to `CareerContentBundle` and `patent` to the placeholder `EntityType`. Verify with schema tests for a valid patent and a malformed number (`12530268`).
- [x] 1.2 Load `patents/*.md` in `libs/content/src/load.ts` (a missing directory means no patents). Extend `validateReferences` to check `role` references and report a duplicate `number` naming both files. Verify with load tests for the dangling-role and duplicate-number scenarios, and that the bundle sorts patents by `issued`, newest first.
- [x] 1.3 Document the `patents/<number>.md` entity in `libs/content/README.md` (fields table plus the file-naming rule). Verify `pnpm exec nx run-many -t test lint -p content` passes.

## 2. Patent content

- [x] 2.1 Add the 12 patent files under `libs/content/content/patents/`. Copy titles, numbers and issue dates exactly from Brian's LinkedIn list. Use assignee `Dell` with role `dell-emc-senior-principal-engineer` for the 11 Dell patents, and `Avaya` with role `avaya-software-engineer-1999` for US8218532B1. Write a one-sentence plain-language summary for each. Verify content validation passes and the bundle reports 12 patents and 0 placeholders.
- [x] 2.2 Give the `data-protection-patents` achievement a short Markdown body linking to `/patents`. Verify the link renders on `/achievements/data-protection-patents` in the pre-rendered HTML.

## 3. Patents page

- [x] 3.1 Add the `patents` route kind to `libs/page-templates/src/routes.ts` (shell page: `owner: null`, `slots: []`) and include `/patents` in `prerenderPaths`. Verify with route tests that `/patents` and `/patents/` match, `/patents/x` is not-found, and `prerenderPaths` contains `/patents`.
- [x] 3.2 Add `patentNumber()` (`US12530268B2` → `US 12,530,268 B2`), `patentUrl()` (→ `https://patents.google.com/patent/US12530268B2/en`) and a full-date formatter (`2026-01-20` → `Jan 20, 2026`). Verify with unit tests, including a 7-digit number (`US8218532B1` → `US 8,218,532 B1`).
- [x] 3.3 Add the patents view to `routeView` and a `pageTitle` case. The view needs a section header whose lede states the count from content, newest-first entries with the title linking to Google Patents (new tab, visually hidden notice), number, date, assignee and summary, and a timeline link when `role` is set. Verify with template tests that every patent's title, formatted number and URL appear, entries are ordered by date, and each entry links to its role on the timeline (`/timeline#avaya-software-engineer-1999` for the Avaya patent).
- [x] 3.4 Add "Patents" after "Skills" in the header nav in `apps/shell/src/index.html`. Verify that clicking it in the dev server navigates client-side to `/patents` without a full reload, and that the route test in the shell router suite covers `/patents`.

## 4. Pre-render and metadata

- [x] 4.1 Add a `patents` case to `pageMeta` in `tools/prerender/src/meta.ts` (title `Patents · <name>`, a description built from the count and titles, and an OG image). Verify with prerender tests that `/patents/index.html` contains every patent title and Google Patents link, its own title, description and canonical URL, and that the sitemap lists `/patents`. Update the snapshot if the header nav appears in it.

## 5. End-to-end checks

- [x] 5.1 Add `/patents` to the page lists in `apps/e2e/tests/a11y.spec.ts`, `csp.spec.ts`, `seo.spec.ts` (pre-rendered content without JavaScript) and `apps/e2e/lighthouserc.cjs`. Verify the full e2e suite passes locally (the visual baselines do not include the header nav, so they need no update).
- [ ] 5.2 After merge, verify on staging that `/patents` lists 12 patents, a sample of the Google Patents links open the right patents, and the page reads well at phone width (the header nav is hidden below the `sm` breakpoint on every page, so on phones `/patents` is reached through the patents achievement). Record the check in the `docs/operations.md` verification log.

## Workflow follow-up

- Approve the production deploy, check `https://befreeman.com/patents`, and close Jira TODOS-60.
- Archive the change and sync the three delta specs into the main specs.
