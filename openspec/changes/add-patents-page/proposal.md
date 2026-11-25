# Proposal

## Why

Brian is a named inventor on 12 issued U.S. patents (11 from Dell EMC, 1 from Avaya). Today the site only mentions the
Dell count in one achievement and one role bullet. Visitors can't see the patents themselves or check them. A Patents page
with each patent linked to its public record on Google Patents turns that claim into evidence. The portfolio epic
(TODOS-6) asked for this page, and Jira TODOS-60 tracks it.

## What Changes

- Add **patents** as a new kind of career content. Each patent records its title, U.S. publication number (for example
  `US12530268B2`), issue date, assignee, a short summary, and optionally the role it was invented in. The content
  validator checks these fields like every other entity. Patents travel in the same content bundle as everything else.
- Add the 12 patents as content, taken from Brian's LinkedIn patent list.
- Add a pre-rendered **`/patents`** page listing every patent, newest first. Each entry shows the title, the formatted
  number, the issue date, the assignee and the summary, and links to `https://patents.google.com/patent/<number>/en`.
  The shell renders the page itself, with no micro-frontend remote, and it works without JavaScript.
- Add a "Patents" link to the site header navigation.
- Give `/patents` the standard page metadata, a social preview image and a sitemap entry, like the other pages.
- Link the existing "Eleven issued U.S. patents in data protection" achievement to the new page. Its "11" stays, because
  that achievement covers only the Dell work.

Out of scope: patent detail pages, co-inventor lists, patent figures or full claims, and structured data for the patents
(schema.org has no patent type in its core vocabulary). The Writing and About pages from TODOS-6 get their own changes.

## Capabilities

### New Capabilities

None. Patents fit the existing career content, showcase and discoverability capabilities.

### Modified Capabilities

- `career-content`: the content model gains a patent entity, and a new requirement says what a patent must carry and how
  it is validated.
- `career-showcase`: a new requirement for the Patents page (what each entry shows, and the Google Patents link).
- `discoverability`: the pre-rendered pages requirement now names the Patents page alongside the home and achievement
  pages.

## Impact

- `libs/content`: patent schema, the loader reads `patents/*.md`, reference validation of `role`, bundle and placeholder
  report types, career-agent corpus chunks, README authoring guide, and new content files under `content/patents/`.
- `libs/page-templates`: a `patents` route kind (a shell page with no owner remote), the patents view, the page title,
  and `prerenderPaths`.
- `apps/shell`: a header nav link. Client-side navigation already renders shell pages through `routeView`.
- `tools/prerender`: metadata and the preview image for `/patents`. The page reaches the sitemap automatically through
  `prerenderPaths`.
- `apps/e2e`: add `/patents` to the accessibility, CSP and SEO page lists.
- Deploy: content and shell changes ship through the normal staging → production pipeline. No Worker or remote changes.
