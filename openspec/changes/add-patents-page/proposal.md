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
  The page works without JavaScript.
- Build the page as a new **patents micro-frontend remote, written in Svelte**. It owns `/patents` the way the Angular,
  Vue and React remotes own their sections: loaded from the deployment manifest, mounted through the shared mount
  contract, and released and rolled back on its own. That makes four frameworks composed on one site, with a fourth color
  in the architecture view. The shell's pre-rendered list stays as the fallback until the remote takes over.
- Add a "Patents" link to the site header navigation.
- Give `/patents` the standard page metadata, a social preview image and a sitemap entry, like the other pages.
- Link the existing "Eleven issued U.S. patents in data protection" achievement to the new page. Its "11" stays, because
  that achievement covers only the Dell work.

Out of scope: patent detail pages, co-inventor lists, patent figures or full claims, and structured data for the patents
(schema.org has no patent type in its core vocabulary). The Writing and About pages from TODOS-6 get their own changes.

## Capabilities

### New Capabilities

None. Patents fit the existing career content, showcase, discoverability and micro-frontend composition capabilities.

### Modified Capabilities

- `career-content`: the content model gains a patent entity, and a new requirement says what a patent must carry and how
  it is validated.
- `career-showcase`: a new requirement for the Patents page (what each entry shows, and the Google Patents link).
- `discoverability`: the pre-rendered pages requirement now names the Patents page alongside the home and achievement
  pages.
- `microfrontend-composition`: framework coexistence now covers a Svelte remote alongside the Angular, Vue and React
  ones, including clean hand-offs when navigating between remotes built in different frameworks. A new requirement
  makes the rule explicit: every section that presents career content is a remote, and the shell owns only the chrome,
  routing, the not-found page, the architecture view and the pre-rendered fallbacks. The repo's CLAUDE.md says the same
  for anyone planning a change.

## Impact

- `libs/content`: patent schema, the loader reads `patents/*.md`, reference validation of `role`, bundle and placeholder
  report types, career-agent corpus chunks, README authoring guide, and new content files under `content/patents/`.
- `apps/remote-patents` (new): Svelte 5 remote built with Vite and Module Federation (`bf_patents`), Tailwind adopted
  into its shadow root, unit tests through the shared mount-in-shadow harness.
- `libs/mfe-contract`: the `patents` entry in the remote registry (scope, framework `svelte`, build output, smoke page).
- `libs/page-templates`: `patents` joins the remote names and prefixes, gets a slot holding the static list, a page
  title, and an entry in `prerenderPaths`.
- `apps/shell`: a header nav link, the Svelte color and label in the architecture view, and footer copy naming four
  frameworks.
- `tools/release`: `remote-patents` maps to the `patents` artifact in the deploy plan and promotion order.
- `tools/prerender`: metadata and the preview image for `/patents`. The page reaches the sitemap automatically through
  `prerenderPaths`.
- `apps/e2e`: build the new remote before the suite, and add `/patents` to the accessibility, CSP, SEO, routing and
  layout-shift checks.
- Docs: README and `docs/operations.md` list the fourth remote.
- Deploy: the first deploy after merge publishes and promotes the new `patents` remote (staging, then production) along
  with content and the Worker. No Worker code changes.
