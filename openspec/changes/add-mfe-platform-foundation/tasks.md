# Tasks

## 1. Workspace setup

- [x] 1.1 Initialize a pnpm + Nx workspace (Node LTS, TypeScript strict, ESLint, Prettier). Verify that `pnpm install` and `pnpm nx graph --file=graph.json` succeed.
- [x] 1.2 Create the folder layout from design D1 and configure Nx project tags and `@nx/enforce-module-boundaries`. Verify that a deliberate remote-to-remote import fails `nx lint`.
- [x] 1.3 Add a root `README.md` covering the workspace layout, prerequisites, and the commands to build, serve, and test everything. Verify each documented command runs as written.

## 2. Federation spike (Angular risk first)

- [x] 2.1 Spike a minimal framework-neutral host that loads one Angular (zoneless, Rspack + MF 2.0) remote, one Vue (Vite + `@module-federation/vite`) remote, and one React (Rspack + MF 2.0) remote at runtime from a static manifest. Verify all three render together in a browser.
- [x] 2.2 Record the spike outcome and exact pinned versions in design.md. If Angular + Rspack fails, switch to the D3/risk fallback (Angular ESM bundle exposing `mount`) and note it. Verify by updating design.md.

## 3. MFE contract and event bus (`libs/mfe-contract`)

- [x] 3.1 Implement the `RemoteContext` and `Mount` types and a `defineRemote` helper. Verify with type tests (`tsc --noEmit`) on example adapters.
- [x] 3.2 Implement the window-scoped event bus with the Zod event catalog, publish-time validation, and disposable subscriptions. Verify with Vitest tests covering: delivery across two separately imported bus copies, rejection of a malformed payload, and no delivery after dispose.
- [x] 3.3 Document the event catalog and contract versioning rules in `libs/mfe-contract/README.md`. Verify the examples compile.

## 4. Career content (`libs/content`)

- [x] 4.1 Define Zod schemas for profile, role, achievement (required impact statements, optional metrics), case study, and skill, each with stable URL-safe IDs. Verify with schema unit tests.
- [x] 4.2 Implement the loader (Markdown + frontmatter, YAML) and the validator: unique IDs, reference integrity, placeholder counting. Verify with Vitest fixtures for a dangling reference, a duplicate ID, a missing impact statement, and valid content.
- [x] 4.3 Implement the hashed bundle builder as an Nx target that every build depends on. Verify that `nx run content:bundle` emits `content.<hash>.json` and a placeholder warning.
- [x] 4.4 Author placeholder content (profile, 3 roles, 6 achievements, 1 case study, skills across 4 categories), all marked `placeholder: true`. Verify validation passes.
- [x] 4.5 Implement and unit-test `toCorpus()` (chunks carrying entity IDs). Verify that each chunk resolves to an existing entity.
- [x] 4.6 Document the content authoring guide (file locations, fields, how to replace placeholders) in `libs/content/README.md`. Verify by authoring one entity from the guide alone and passing validation.

## 5. Design system and shared components (`libs/design-system`, `libs/ui-components`)

- [x] 5.1 Define the TS token source (color as semantic light and dark values, typography, spacing, radius, shadow, motion). Generate `theme.css` (Tailwind v4 `@theme`), `modes.css`, `document.css` (modes, fonts, `@property` registrations), and `base.css`. Verify with snapshot tests of the generated CSS, plus a unit test that every semantic color pair meets AA contrast in both modes.
- [x] 5.2 Implement the motion primitives, the `prefersReducedMotion()` helper, and the `motion-safe:`/`motion-reduce:` conventions. Verify with unit tests that reduced-motion mode resolves durations to 0 and disables named animations.
- [x] 5.3 Implement `createShadowStyles(cssText)` (a cached constructable `CSSStyleSheet`) and a shared Tailwind entry template for each build (`@tailwindcss/postcss` and `@tailwindcss/vite`). Verify with a Playwright fixture: a shadow-root element using `bg-accent`, `shadow-lg`, `rotate-3`, and a gradient utility gets the expected computed styles, and flipping `data-theme` changes `bg-accent` without a reload.
- [x] 5.4 Implement `bf-button`, `bf-card`, `bf-chip`, `bf-dialog` (native `<dialog>`), and `bf-theme-toggle` as Lit elements, registered through `defineOnce` and styled from the shared theme. Verify with Vitest browser-mode tests: keyboard behavior, dialog focus trap, Escape, focus return, and axe with no violations in both modes.
- [x] 5.5 Generate the Custom Elements Manifest and the React JSX, Vue `GlobalComponents`, and Angular typings. Add a lint rule that blocks remotes from importing the `ui-components` runtime entry. Verify that typecheck fixtures in each framework compile when using `bf-button` with props and events, and that a runtime import fails lint.
- [x] 5.6 Build `ui-components` as a standalone versioned artifact (ESM entry with an embedded sheet). Verify that the build output loads in a blank page and defines all five tags.
- [x] 5.7 Document theme usage, mode behavior, the shadow-style helper, and component usage per framework in `libs/design-system/README.md` and `libs/ui-components/README.md`. Verify the documented snippets compile in the typecheck fixtures.

## 6. Shell (`apps/shell`)

- [x] 6.1 Build the framework-neutral shell with Rspack and Tailwind: global `document.css`, layout, nav, hero, contact (obfuscated email path), and the not-found page, using the shared theme and `bf-*` components. Verify the dev server renders at `/` and that the raw email address is absent from the built HTML (grep test).
- [x] 6.2 Implement the mode controller: pre-paint inline script, `bf-theme-toggle` wiring, guarded `localStorage` persistence, `data-theme` on `<html>`, and `theme:changed`. Verify with Playwright: a system-dark first visit renders dark, toggling switches without reload, the choice persists after reload, and no wrong-mode flash appears (screenshot at first paint).
- [x] 6.3 Implement the manifest fetch, loading `ui` and awaiting `customElements.whenDefined` before any mount, MF runtime `registerRemotes`/`loadRemote`, and the prefix-owned router with sub-path handoff, `nav:request` handling, and `route:changed` publishing. Verify with Vitest router tests and a deep-link e2e for `/achievements/<id>`.
- [x] 6.4 Implement the mount lifecycle: lazy mounting on viewport approach, shadow-root containers, an 8 s timeout, try/catch, pre-rendered fallback, the unavailable notice, and `remote:error`. Verify with unit tests that use a failing fake remote.
- [x] 6.5 Implement the architecture view toggle: outlines and labels for name, framework, and version, plus an unavailable state. Verify with a Playwright test that toggles the view and asserts the labels match the manifest.

## 7. Achievements remote (Angular)

- [x] 7.1 Scaffold a zoneless Angular remote exposing `./mount` through an adapter (shadow root, compiled Tailwind sheet adopted through `createShadowStyles`, `CUSTOM_ELEMENTS_SCHEMA` for `bf-*`). Verify with the contract test: mount into JSDOM, render, unmount, and confirm no DOM or bus listeners remain.
- [x] 7.2 Implement the achievement list with technology and role filters reflected in the URL, plus the detail view with impact, metrics, technologies, a role link (`nav:request`), and a case-study link. Verify with component tests.
- [x] 7.3 Handle `entity:focus` for roles and achievements (highlight and scroll). Verify with a component test that publishes a focus event.

## 8. Timeline remote (Vue)

- [x] 8.1 Scaffold a Vue 3 remote exposing `./mount` through an adapter (shadow root, `@tailwindcss/vite` sheet adopted through `createShadowStyles`, `isCustomElement` configured for `bf-*`). Verify with the contract test (mount, render, unmount, no leftovers).
- [x] 8.2 Implement the interactive chronological timeline with expandable roles, linked achievements (`nav:request`), and motion through the token primitives, plus a text-alternative list view. Verify with component tests, including reduced-motion mode.
- [x] 8.3 Handle `entity:focus` for roles. Verify with a component test.

## 9. Skills remote (React)

- [x] 9.1 Scaffold a React remote exposing `./mount` through an adapter (shadow root, Tailwind sheet adopted through `createShadowStyles`, `bf-*` JSX typings). Verify with the contract test (mount, render, unmount, no leftovers).
- [x] 9.2 Implement the skills radar grouped by category with relative proficiency, keyboard navigation between skills, a text-alternative table, and selection that reveals demonstrating achievements. Verify with Testing Library tests, including keyboard-only selection.
- [x] 9.3 Handle `entity:focus` for skills, and redraw the canvas radar on `theme:changed` using the TS token values. Verify with component tests for focus and for a mode switch.

## 10. Pre-rendering and discoverability (`tools/prerender`)

- [x] 10.1 Render `/`, `/achievements/<id>`, `/timeline`, `/skills`, and `404.html` from the content bundle into the shell template, with reserved slot dimensions. Verify with a test that fetches each built page with JavaScript disabled (Playwright `javaScriptEnabled: false`) and asserts the content is present.
- [x] 10.2 Emit per-page title, description, canonical URL, and OG/Twitter tags, plus OG images generated with Satori. Verify with snapshot tests of the head tags and the presence of the image files.
- [x] 10.3 Emit JSON-LD `Person` on the home page, plus `sitemap.xml` and `robots.txt`. Verify that the JSON-LD parses and matches the profile, and that adding a fixture achievement adds its URL to the sitemap.

## 11. Edge Worker and release tooling (`apps/edge`, `tools/release`)

- [x] 11.1 Implement the Worker: static assets, `/remotes/*` and `/content/*` from R2 with immutable caching, `/mfe-manifest.json` from KV with no-cache and an ETag, CSP `script-src 'self'`, and a reserved `/api/*` route returning 404. Verify with Vitest tests using Miniflare or `@cloudflare/vitest-pool-workers`.
- [x] 11.2 Implement the signed preview override `?mfe-override=<name>@<version>` (HMAC token required, R2-existing versions only). Verify with Worker tests for a valid token, a missing token, and an unknown version.
- [x] 11.3 Implement `publish-remote`, which also handles the `ui` artifact (refuses existing version prefixes), `promote` (smoke check, then an atomic manifest write with history), and `rollback`. Verify with tests against Miniflare R2/KV, covering the duplicate-version refusal, rollback to the prior manifest, and `ui` promotion blocked when any live remote's smoke check fails.
- [x] 11.4 Write `docs/operations.md` covering Cloudflare resources, secrets (as Bitbucket secured deployment variables), and the publish, promote, rollback, and preview-link commands. Verify each command against the local Worker (`wrangler dev` with local R2/KV) and record the result in its verification log.

## 12. CI on Bitbucket Cloud Pipelines (free plan)

- [x] 12.1 Add `bitbucket-pipelines.yml` with a pull-request pipeline that runs `nx affected -t lint typecheck test build --base=origin/$BITBUCKET_PR_DESTINATION_BRANCH` in the Playwright image, with full clone depth and pnpm and Nx caches. Verify locally that the same command, after changing only the timeline, runs only the timeline and its dependents; then verify the pipeline passes on a Bitbucket PR.
- [ ] 12.2 Add a `main` branch pipeline and a manual `full` custom pipeline that run the Playwright suite (including the axe audits) and Lighthouse CI against the local compose server, with CLS ≤ 0.1 and per-remote JS and CSS budgets. Verify locally that Lighthouse CI fails on a deliberately exceeded budget and the axe canary fails on a deliberate violation; then verify the `main` pipeline passes on Bitbucket.

## 13. Integration verification

- [x] 13.1 Run the full Playwright suite against the composed site, both on the local compose server and through the local Worker (`wrangler dev`). It covers: all three remotes coexisting, deep links, cross-remote `entity:focus`, failure isolation (blocked remote route keeps the pre-rendered content and shows the notice), CSP enforcement, the reduced-motion profile, a 375px viewport with no horizontal scroll, a light/dark toggle updating every section together, and visual-regression screenshots showing the same `bf-button` variant identical in all three remotes. Verify all tests pass in both setups.

## Workflow follow-up

- Propose a follow-up change, `deploy-to-cloudflare`, for the work deferred until the Cloudflare account exists:
  - Create the Cloudflare resources and secrets from `docs/operations.md`, and verify every release command against staging (`--remote --env staging`).
  - Add Bitbucket deployment steps: on merge to `main`, publish and promote each affected remote, the shell, the `ui` component library, and the content bundle to the `staging` deployment environment; add a manually triggered `production` step. Use secured deployment variables for the Cloudflare credentials and `PREVIEW_SECRET`. Verify that a merge promotes to staging and the manifest reflects the new versions.
  - Run the full Playwright suite against staging.
  - Do a manual rollback drill on staging: promote a deliberately broken remote with smoke checks bypassed through a test flag, roll it back, and confirm new page loads use the prior version. Record the result in `docs/operations.md`.
- Review the framework assignment (design D2) with Brian before starting group 7.
- Import real resume, LinkedIn, and write-up content (separate change) before the DNS cutover to befreeman.com.
- Archive this change after review, then propose `add-career-agent`.
