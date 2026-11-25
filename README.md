# befreeman.com

Brian Freeman's professional site, built to *be* the portfolio: four micro frontends in **Angular**, **React**, **Vue**, and **Svelte**, composed at runtime into one site by a framework-neutral shell and served from the Cloudflare edge.

- **Runtime composition**: the shell reads `/mfe-manifest.json` and loads each remote with Module Federation 2.0. Every remote is built, versioned, released, and rolled back on its own.
- **Framework-agnostic contract**: each remote exposes one `mount(el, ctx)` function and renders in its own shadow root. Remotes coordinate only through a typed event bus.
- **Shared design system**: a Tailwind CSS v4 theme with light and dark modes, plus Lit Web Components (`bf-button`, `bf-card`, ...) used by every framework.
- **Crawlable first**: every page is pre-rendered from the career content, so it works without JavaScript and remotes enhance it. A failed remote leaves the static version in place.
- **Agent-ready**: the content package already exports a citeable corpus, and the event bus already supports navigation and focus requests, for the upcoming career agent.

Press the `</>` button in the site header to outline each remote with its framework and deployed version.

## Workspace layout

```
apps/
  shell/                 framework-neutral host (TypeScript, Rspack): layout, routing, theme, mounting
  remote-achievements/   Angular 22 (zoneless) remote: achievements & case studies
  remote-timeline/       Vue 3 remote: interactive career timeline
  remote-skills/         React 19 remote: skills radar
  remote-patents/        Svelte 5 remote: issued patents
  edge/                  Cloudflare Worker: manifest, versioned artifacts, security headers
  e2e/                   Playwright suite + local compose server
libs/
  content/               career content (Markdown/YAML), schemas, validation, bundle, agent corpus
  mfe-contract/          mount contract, typed event bus, manifest schema, preview signing
  design-system/         design tokens → Tailwind theme, mode variables, motion, shadow-DOM styles
  ui-components/         Lit custom elements + React/Vue/Angular typings
  page-templates/        route table + static templates shared by the shell and the pre-renderer
tools/
  prerender/             crawlable pages, metadata, JSON-LD, OG images, sitemap
  release/               publish / promote / rollback CLI
openspec/                specs and change proposals (spec-driven development)
```

Nx tags and lint rules keep the boundaries:
- apps and tools may depend only on libraries;
- remotes never import each other;
- remotes import `ui-components` types only, never the runtime.

## Prerequisites

- Node.js **22.22.3+** (see `.nvmrc`; Angular's build tools require it)
- pnpm **10** (`npm i -g pnpm@10`)
- Chromium for browser tests: `pnpm exec playwright install chromium`
- For deployment only: a Cloudflare account (see [docs/operations.md](docs/operations.md))

## Common commands

```bash
pnpm install

# Develop
pnpm serve:composed             # build everything, then serve the composed site at http://localhost:4300
pnpm dev                        # shell dev server at http://localhost:4200 (needs serve:composed running for remotes)
pnpm nx serve edge              # the real Worker via wrangler dev at http://localhost:8787 (after a local release; see docs/operations.md)

# Build
pnpm nx run-many -t build       # every app and library
pnpm nx run prerender:run       # shell + pre-rendered pages, OG images, sitemap (into dist/apps/shell)

# Test
pnpm nx run-many -t test        # unit, component, contract, and Worker tests (jsdom, Chromium, workerd)
pnpm nx run-many -t lint typecheck
pnpm nx run e2e:e2e             # Playwright against the composed site (builds and pre-renders first)
pnpm nx affected -t lint test build   # only what changed

# Content
pnpm nx run content:validate    # check career content; lists remaining placeholders
```

Edit your career content in `libs/content/content/`. The [content guide](libs/content/README.md) explains every field, and the build fails on invalid content.

## Releasing

Each remote, the `ui` library, and the content bundle are published to immutable versioned paths, then **promoted** by updating the manifest. Promotion runs a smoke check first. Rollback is a single manifest write.

```bash
pnpm release publish timeline --remote --env staging
PREVIEW_SECRET=… pnpm release promote timeline <version> --base-url https://<staging> --remote --env staging
pnpm release rollback timeline --remote --env staging
```

See [docs/operations.md](docs/operations.md) for Cloudflare setup, secrets, and the full runbook.

## More documentation

- [libs/mfe-contract](libs/mfe-contract/README.md): mount contract, event catalog, versioning rules
- [libs/design-system](libs/design-system/README.md): theme, modes, motion, Tailwind in shadow DOM
- [libs/ui-components](libs/ui-components/README.md): components and per-framework usage
- [libs/content](libs/content/README.md): content authoring guide
- [openspec/](openspec/): requirements and design decisions
