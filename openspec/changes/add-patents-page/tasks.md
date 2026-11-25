# Tasks

## 1. Patent content model

- [x] 1.1 Add `patentSchema` (`id`, `title`, `number` matching `^US\d{7,8}[AB]\d$`, `issued` as `YYYY-MM-DD`, `assignee`, `summary`, optional `role`, `placeholder`) and a full-date schema to `libs/content/src/schema.ts`. Add `patents` (newest first) to `CareerContentBundle` and `patent` to the placeholder `EntityType`. Verify with schema tests for a valid patent and a malformed number (`12530268`).
- [x] 1.2 Load `patents/*.md` in `libs/content/src/load.ts` (a missing directory means no patents). Extend `validateReferences` to check `role` references and report a duplicate `number` naming both files. Verify with load tests for the dangling-role and duplicate-number scenarios, and that the bundle sorts patents by `issued`, newest first.
- [x] 1.3 Document the `patents/<number>.md` entity in `libs/content/README.md` (fields table plus the file-naming rule). Verify `pnpm exec nx run-many -t test lint -p content` passes.

## 2. Patent content

- [x] 2.1 Add the 12 patent files under `libs/content/content/patents/`. Copy titles, numbers and issue dates exactly from Brian's LinkedIn list. Use assignee `Dell` with role `dell-emc-senior-principal-engineer` for the 11 Dell patents, and `Avaya` with role `avaya-software-engineer-1999` for US8218532B1. Write a one-sentence plain-language summary for each. Verify content validation passes and the bundle reports 12 patents and 0 placeholders.
- [x] 2.2 Give the `data-protection-patents` achievement a short Markdown body linking to `/patents`. Verify the link renders on `/achievements/data-protection-patents` in the pre-rendered HTML.

## 3. Patents page

- [x] 3.1 Add `patents` to `REMOTE_NAMES` and `PREFIXES` in `libs/page-templates/src/routes.ts`, so `/patents` is owned by the `patents` remote (`slots: ['patents']`), and include `/patents` in `prerenderPaths`. Verify with route tests that `/patents` and `/patents/` match with owner `patents`, `/patents/x` is not-found, the home page still hosts only achievements, timeline and skills, and `prerenderPaths` contains `/patents`.
- [x] 3.2 Add `patentNumber()` (`US12530268B2` → `US 12,530,268 B2`), `patentUrl()` (→ `https://patents.google.com/patent/US12530268B2/en`) and a full-date formatter (`2026-01-20` → `Jan 20, 2026`). Verify with unit tests, including a 7-digit number (`US8218532B1` → `US 8,218,532 B1`).
- [x] 3.3 Add the patents view to `routeView` (the static list inside a `patents` slot, the fallback the remote takes over) and a `pageTitle` case. The view needs a section header whose lede states the count from content, newest-first entries with the title linking to Google Patents (new tab, visually hidden notice), number, date, assignee and summary, and a timeline link when `role` is set. Verify with template tests that every patent's title, formatted number and URL appear, entries are ordered by date, and each entry links to its role on the timeline (`/timeline#avaya-software-engineer-1999` for the Avaya patent).
- [x] 3.4 Add "Patents" after "Skills" in the header nav in `apps/shell/src/index.html`, a Svelte framework color (`#ff3e00`) in the architecture-view styles, a `patents` label in the shell's mount manager, and footer copy naming four frameworks. Verify that the shell router test covers `/patents` with owner `patents`, and the e2e routing test clicks the nav link and gets client-side navigation with no reload.

## 4. Patents remote (Svelte)

- [x] 4.1 Scaffold `apps/remote-patents`: `package.json` (`svelte` 5.59.1, `@sveltejs/vite-plugin-svelte` 7.3.2, `svelte-check`, workspace deps), `project.json` (tags `type:remote`, `framework:svelte`; build, typecheck, test, lint), Vite config with Module Federation (`bf_patents`, exposes `./mount`, port 4204), Vitest config, tsconfig, ESLint config and a Tailwind `styles.css`. Verify `pnpm install` succeeds and `nx show project remote-patents` lists the targets.
- [x] 4.2 Write the Svelte components and `src/mount.ts` (`defineRemote`, styles adopted into the shadow root, `update()` applies new content, `unmount()` tears down). Render the same markup as the static list, using the `page-templates` formatting helpers. Verify with unit tests through `mountInShadow` that all patents render newest first with title, formatted number, date, assignee, summary, Google Patents link (new tab, hidden notice) and timeline link, that `update()` re-renders, and that `unmount()` leaves the host empty. `nx run-many -t build typecheck test lint -p remote-patents` passes.
- [x] 4.3 Register the remote: `REMOTE_REGISTRY.patents` in `libs/mfe-contract/src/registry.ts`, `remote-patents` → `patents` in `PROJECT_ARTIFACTS`, and `patents` in `ALL_PARTS` after `skills` (`tools/release/src/deploy.ts`). Add `remote-patents` to the e2e build dependencies (`apps/e2e/project.json`) and the build commands in `docs/operations.md`, and list the remote in `README.md`. Verify the release and mfe-contract tests pass with the planner mapping `remote-patents` to `patents`, and the compose server serves `/remotes/patents/local/remoteEntry.js`.

## 5. Pre-render and metadata

- [x] 5.1 Add a `patents` case to `pageMeta` in `tools/prerender/src/meta.ts` (title `Patents · <name>`, a description built from the count and titles, and an OG image). Verify with prerender tests that `/patents/index.html` contains every patent title and Google Patents link, its own title, description and canonical URL, and that the sitemap lists `/patents`. Update the snapshot if the header nav appears in it.

## 6. End-to-end checks

- [x] 6.1 Add `/patents` to the page lists in `apps/e2e/tests/a11y.spec.ts`, `csp.spec.ts`, `seo.spec.ts` (pre-rendered content without JavaScript, plus the layout-shift check on remote takeover) and `apps/e2e/lighthouserc.cjs`. Add routing tests: the nav link mounts the `patents` remote (framework `svelte`) with no reload, React → Svelte → React navigation leaves no stray hosts, and the architecture view labels the slot `patents · svelte · <version>`. Verify the full e2e suite and Lighthouse pass locally.
- [ ] 6.2 After merge, verify on staging that `/patents` lists 12 patents, a sample of the Google Patents links open the right patents, and the page reads well at phone width (the header nav is hidden below the `sm` breakpoint on every page, so on phones `/patents` is reached through the patents achievement). Record the check in the `docs/operations.md` verification log.

## Workflow follow-up

- Approve the production deploy, check `https://befreeman.com/patents`, and close Jira TODOS-60.
- Archive the change and sync the four delta specs into the main specs once TODOS-61 has moved the Achievements, Timeline and Skills headings into their remotes, so the main spec's "Content sections are remotes" requirement holds for every section.
