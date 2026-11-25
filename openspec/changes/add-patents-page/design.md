# Design

## Context

Career content is Markdown and YAML under `libs/content/content/`. `loadContent` validates it with zod schemas
(`libs/content/src/schema.ts`), `validateReferences` checks the cross-entity references, and the result ships as one
hashed content bundle. Routing lives in `libs/page-templates/src/routes.ts`. `matchRoute` assigns each top-level prefix to
a remote (achievements in Angular, timeline in Vue, skills in React). `routeView` renders static markup inside
`[data-slot]` elements, which the pre-renderer writes to `<route>/index.html` and the shell reuses for client-side
navigation. The shell then mounts the owning remote over its slot, through Module Federation and the
`defineRemote` mount contract in `libs/mfe-contract`. Each remote is listed in `REMOTE_REGISTRY` and released on its own by
`tools/release`. The header nav is static HTML in `apps/shell/src/index.html`. The pre-renderer takes its page list, sitemap and
OG images from `prerenderPaths` and `pageMeta`.

See proposal.md for why.

## Goals / Non-Goals

**Goals:**
- The page is readable without JavaScript and identical with it: the same static markup serves both paths.
- The Patents page follows the site's pattern: a remote that owns its prefix and is released on its own, written in a
  fourth framework (Svelte) to keep the site's point that frameworks compose at runtime.
- The patent data has one source (the content files), so the bundle, page, metadata and sitemap can't disagree.

**Non-Goals:**
- Fetching patent data from Google Patents or any other API at build time or at runtime.
- Filtering or search on the Patents page. The remote shows the same list as the pre-rendered page, no more.
- Svelte support in the shared UI components beyond what custom elements already give every framework.

## Decisions

**D1. One Markdown file per patent, named by its lowercased publication number.** For example
`content/patents/us12530268b2.md`, with frontmatter `title`, `number`, `issued`, `assignee`, `summary`, and an optional
`role`. The publication number is already unique, stable and close to URL-safe, so it makes a natural ID. Title slugs
would be long and could collide.
*Alternative:* one `patents.yaml` like `skills.yaml`. Rejected because per-file entities match roles, achievements and
case studies, keep diffs small, and leave room for a Markdown body later.

**D2. Validation.**
- `number` must match `^US\d{7,8}[AB]\d$`, which covers B1, B2 and published applications.
- `issued` is a full `YYYY-MM-DD` date, because patents issue on a specific day. It uses a new date schema next to
  `yearMonthSchema`.
- `assignee` and `summary` are non-empty strings.
- `role` uses the existing role-reference check.
- A duplicate publication number is reported as an issue naming both files.

The placeholder report gains a `patent` entity type, so the existing warning covers patents too.

**D3. The Google Patents URL and the display number are derived, not stored.** The URL is
`https://patents.google.com/patent/${number}/en`. The display form adds a space after `US`, commas in the digits, and a
space before the kind code, so `US12530268B2` becomes `US 12,530,268 B2`. Both come from small helpers in
`page-templates`, so there is one formatting rule and a content file can't link somewhere else by mistake.
*Alternative:* store a `url` per patent. Rejected because it's redundant and can drift from the number.

**D4. `/patents` is owned by a new `patents` remote, written in Svelte 5.** It sits in `apps/remote-patents`, laid out
like the Vue timeline remote:
- **Build:** Vite with `@sveltejs/vite-plugin-svelte` and `@module-federation/vite`. The container is `bf_patents`, it
  exposes `./mount`, it builds an ESM `remoteEntry.js`, and it uses dev port 4204.
- **Mount:** `src/mount.ts` wraps a Svelte `mount()`/`unmount()` pair in `defineRemote`, adopts the Tailwind stylesheet
  into its shadow root, and takes route and content updates through `update()`.
- **Registry:** `REMOTE_REGISTRY.patents = { scope: 'bf_patents', type: 'module', framework: 'svelte', dist:
  'dist/apps/remote-patents', page: '/patents' }`. Because the release tool, compose server, CLI and manifest all read
  the registry, the remote ships through the existing pipeline.
- **Deploy plan:** `PROJECT_ARTIFACTS` maps `remote-patents` to `patents`, and `ALL_PARTS` gains it after `skills`.
- **Routing:** `patents` joins `REMOTE_NAMES` and `PREFIXES`. `/patents` returns `{ kind: 'patents', owner: 'patents',
  slots: ['patents'] }`, and deeper paths are not found, as with timeline and skills.
- **Fallback:** `routeView` wraps the static list in a `patents` slot, so crawlers and no-JavaScript visitors get the
  same content. If the remote fails, the slot keeps the static list, as the failure-isolation requirement already
  demands.
- **Formatting:** the remote imports `patentNumber`, `patentUrl` and `formatDate` from `@befreeman/page-templates`, so the
  static page and the live remote format numbers, links and dates the same way (D3).

*Alternatives:*
- A shell page with no remote. This was the first plan, and it broke the site's rule that every content section is a
  remote, so Brian rejected it.
- Another remote in an existing framework. Rejected because a fourth framework strengthens the portfolio's
  runtime-composition story at no extra cost to the shell.
- Folding patents into the achievements remote under `/achievements/patents`. Rejected because it would clash with
  achievement IDs and isn't where visitors would look.

**D5. Page layout.**
- **Header:** the same section header as the other pages, with the eyebrow "Inventions", the title "Patents", and a lede
  that states the count from the content ("12 issued U.S. patents…"), so the number is never hand-written. The header
  is part of the section: the remote renders it, and the pre-rendered fallback keeps it inside the `patents` slot. The
  shell renders no section labels of its own.
- **Entries:** a list of cards, newest first.
  - **Title:** an `<h2>` containing the external link (`target="_blank"`, `rel="noopener noreferrer"`), with a visually
    hidden "(opens Google Patents in a new tab)" suffix.
  - **Details line:** the formatted number, the issue date (for example "Jan 20, 2026"), and the assignee.
  - **Summary.**
  - **Role:** when `role` is set, the entry links to `/timeline#<role-id>`.

**D6. Navigation and cross-links.**
- **Header nav:** "Patents" goes after "Skills" in `apps/shell/src/index.html`.
- **Architecture view and copy:** the shell gets a Svelte framework color (`#ff3e00`) and a `patents` label. The footer
  and README name four frameworks.
- **Patents achievement:** the `data-protection-patents` achievement gains a short Markdown body linking to
  `/patents`. The shell's static view and the Angular remote both already render an achievement's body.
- **Dell role:** the role bullet keeps saying 11, because it describes the Dell work.
- **Career agent corpus:** `toCorpus` covers every content entity (its tests enforce this), so each patent becomes a corpus
  chunk pointing at `/patents#<id>`.

**D7. Patent content.**
- **Source:** titles, numbers and dates are copied exactly from Brian's LinkedIn list.
- **Summaries:** each `summary` is one plain-language sentence written from the LinkedIn abstract, not the legal abstract
  itself. Brian reviews them before the change is merged.
- **Roles:** the 11 Dell patents reference `dell-emc-senior-principal-engineer`. Several issued after Brian left Dell
  in 2022-01, but the role records where the invention was made. The Avaya patent (US8218532B1, issued 2012) references
  `avaya-software-engineer-1999`, because Brian made the invention during that 1999–2008 role.
- **Assignee:** "Dell" or "Avaya", the company Brian invented for, rather than the legal assignee entity (for example
  EMC IP Holding Company LLC). Visitors recognize the employer names.

## Risks / Trade-offs

- [Summaries misstate a patent] → They're short and plain, and Brian reviews them. The link to the full record is right
  beside each one.
- [Header nav change breaks visual or a11y baselines] → The a11y suite covers `/patents`. The visual baselines capture
  page sections, not the header, so they don't change.
- [Google Patents changes its URL scheme] → The URL comes from one helper, so a fix is one line and a content rebuild.
- [The first production deploy promotes a remote that production has never had] → `withVersion` adds a missing manifest
  entry, and the smoke check loads `/patents` before promotion. Until then, the slot shows the pre-rendered list with
  the "interactive version unavailable" notice.
- [Svelte styles leak or global listeners outlive unmount] → The remote renders inside the shell's shadow root with
  adopted styles only, and its unit tests check unmount leaves an empty host. The routing e2e test moves between the
  React and Svelte remotes and back.
- [No header link on phones] → The header nav is hidden below the `sm` breakpoint on every page, so phone visitors reach
  `/patents` through the patents achievement. A mobile menu is a separate, site-wide change.

## Migration Plan

This is additive. Merge to `main` → the staging deploy publishes and promotes `patents` with content and the Worker, and
e2e runs → production approval does the same in production. To roll back the remote alone, run `release rollback
patents`. Removing it entirely means reverting the change, since the pre-rendered page expects the slot. No Worker code
changes.
