# Design

## Context

Career content is Markdown and YAML under `libs/content/content/`. `loadContent` validates it with zod schemas
(`libs/content/src/schema.ts`), `validateReferences` checks the cross-entity references, and the result ships as one
hashed content bundle. Routing lives in `libs/page-templates/src/routes.ts`. `matchRoute` assigns each top-level prefix to
a remote (achievements, timeline, skills). `routeView` renders static markup, which the pre-renderer writes to
`<route>/index.html` and the shell reuses for client-side navigation. A page with no `[data-slot]` elements mounts no
remote. The header nav is static HTML in `apps/shell/src/index.html`. The pre-renderer takes its page list, sitemap and
OG images from `prerenderPaths` and `pageMeta`.

See proposal.md for why.

## Goals / Non-Goals

**Goals:**
- The page is readable without JavaScript and identical with it: the same static markup serves both paths.
- No new deployable unit. The change ships as content plus shell and pre-render changes.
- The patent data has one source (the content files), so the bundle, page, metadata and sitemap can't disagree.

**Non-Goals:**
- Fetching patent data from Google Patents or any other API at build time or at runtime.
- An interactive patents remote, filtering, or search.

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

**D4. `/patents` is a shell page with no remote.** `matchRoute` returns `{ kind: 'patents', owner: null, slots: [] }`,
and `routeView` renders the list directly. The router already handles routes without an owner, and `mountRoute` mounts
nothing when there are no slots. This fits the existing "Shell-owned routing" requirement, which already allows shell
pages, so `microfrontend-composition` doesn't change.
*Alternatives:*
- A new remote. Rejected as a whole deploy unit for a static list.
- Folding patents into the achievements remote under `/achievements/patents`. Rejected because it would clash with
  achievement IDs and isn't where visitors would look.

**D5. Page layout.**
- **Header:** the same section header as the other pages, with the eyebrow "Inventions", the title "Patents", and a lede
  that states the count from the content ("12 issued U.S. patents…"), so the number is never hand-written.
- **Entries:** a list of cards, newest first.
  - **Title:** an `<h2>` containing the external link (`target="_blank"`, `rel="noopener noreferrer"`), with a visually
    hidden "(opens Google Patents in a new tab)" suffix.
  - **Details line:** the formatted number, the issue date (for example "Jan 20, 2026"), and the assignee.
  - **Summary.**
  - **Role:** when `role` is set, the entry links to `/timeline#<role-id>`.

**D6. Navigation and cross-links.**
- **Header nav:** "Patents" goes after "Skills" in `apps/shell/src/index.html`.
- **Patents achievement:** the `data-protection-patents` achievement gains a short Markdown body linking to
  `/patents`. The shell's static view and the Angular remote both already render an achievement's body.
- **Dell role:** the role bullet keeps saying 11, because it describes the Dell work.

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
- [Header nav change breaks visual or a11y baselines] → The e2e visual tests capture the achievement and timeline pages,
  which include the header. Regenerate the baselines in the same change and check the diff shows only the new nav item.
- [Google Patents changes its URL scheme] → The URL comes from one helper, so a fix is one line and a content rebuild.
- [Header nav overflows on narrow screens with a fourth item] → Covered by the existing responsive e2e checks. Shorten
  the gaps if they fail.

## Migration Plan

This is additive. Merge to `main` → staging deploy and e2e → production approval. Rolling back means promoting the
previous release. No data or Worker changes.
