# Design

## Context

The repo is greenfield. It holds only `.gitignore` and the OpenSpec scaffolding. See `proposal.md` for motivation and `specs/` for the behavior contracts. Choices already made with Brian:

- **Composition**: Module Federation, loaded at runtime from a manifest
- **Monorepo**: Nx with pnpm
- **Shell**: framework-neutral; every feature section is a framework remote
- **Hosting**: Cloudflare
- **Remote deployment**: independent and versioned
- **Messaging**: a typed event bus
- **SEO**: important, so pages are pre-rendered
- **Content**: Markdown/JSON in the repo
- **Visual direction**: bold and interactive
- **Styling**: Tailwind CSS v4 as the shared CSS framework, shared Web Components for UI, and remotes kept in Shadow DOM

The agent is a later change, but this design must not block it. Content must be consumable as an agent corpus, the event bus must support agent-driven navigation and focus, and the edge must have room for an API Worker.

## Goals / Non-Goals

**Goals:**
- Real runtime composition of Angular, React, and Vue remotes, each deployable and rollback-able on its own.
- A shell that knows nothing about any framework, only the mount contract.
- One validated content source feeding pre-rendering, remotes, and later the agent.
- Crawlable, fast first paint even if every remote fails.
- CI that only builds what changed.

**Non-Goals:**
- Any LLM or agent code, API Worker, Turnstile, or transcript storage. These come in follow-up changes.
- Sharing framework runtimes between remotes. Each remote bundles its own framework.
- Server-side rendering of remotes. Pre-rendering is a static, content-driven HTML pass, not framework SSR.
- A CMS or admin UI for content.
- Final visual design polish. This change sets up the design system (theme, modes, core components) and the motion primitives.
- A broad component catalog. Only the five core components are built; more are added as features need them.

## Decisions

### D1. Workspace layout (Nx + pnpm)

```
apps/
  shell/                 # framework-neutral TS host (Rspack + MF runtime)
  remote-achievements/   # Angular (zoneless) remote
  remote-timeline/       # Vue 3 remote
  remote-skills/         # React remote
  edge/                  # Cloudflare Worker: manifest, /remotes/* from R2, CSP headers
  e2e/                   # Playwright suite against the composed site
libs/
  content/               # schemas, loaders, validator, bundle builder, placeholder content/
  mfe-contract/          # mount contract types + event bus + event catalog schemas
  design-system/         # token source → Tailwind v4 @theme + mode variables, base layer, motion primitives, shadow-style helper
  ui-components/         # Lit custom elements (button, card, chip, dialog, theme-toggle) + per-framework typings
  page-templates/        # route table + static view templates shared by the shell (client nav) and tools/prerender
tools/
  prerender/             # builds static HTML pages from the content bundle
  release/               # publish-remote, promote, rollback CLI scripts
```

`libs/page-templates` was added during implementation. Apps and tools may not import each other, yet the shell's client-side views and the pre-rendered HTML must be identical (so a failed remote leaves exactly the crawlable fallback), so both render from this one library.

Nx project tags enforce boundaries with `@nx/enforce-module-boundaries`. Apps may depend only on `libs/*`, and no remote may import another remote.
*Alternative considered*: Turborepo. Rejected because Nx's affected graph, boundary lint rules, and framework generators fit a multi-framework repo better.

### D2. Framework assignment

- **Angular** gets achievements and case studies. This is dense, filterable, form-like content, and Angular reads as "enterprise".
- **Vue** gets the interactive timeline. Its transition system suits a motion-heavy, bold UI.
- **React** gets the skills radar. It has a strong data-viz ecosystem, and React will also host the agent console later.
- The shell, in plain TypeScript, owns the hero, navigation, contact, the not-found page, and the architecture view.

This is an assumption recorded for Brian to confirm. Swapping frameworks between remotes does not change the specs.

### D3. Module Federation 2.0 runtime, loaded from a manifest

The shell uses the `@module-federation/enhanced` runtime API to `registerRemotes` from `/mfe-manifest.json` at startup, then `loadRemote('<name>/mount')`. Remotes build with an MF 2.0-compatible plugin and each exposes exactly one module, `./mount`:

- **React**: Rspack with `@module-federation/enhanced`.
- **Vue**: Vite with `@module-federation/vite`.
- **Angular**: Rspack via `@nx/angular-rspack` with `@module-federation/enhanced`.

*Alternatives considered*:
- Native Federation (esbuild-friendly for Angular). Rejected because it does not interoperate cleanly with MF 2.0 remotes built for React and Vue.
- single-spa. Rejected because it adds another lifecycle framework.
- Web Components only. Rejected because the dependency-sharing story is weak and it is a less impressive talking point.

### D4. Framework-agnostic mount contract

`libs/mfe-contract` defines:

```ts
interface RemoteContext {
  route: { path: string; subPath: string; query: URLSearchParams };
  content: CareerContentBundle;
  bus: EventBus;
  tokens: { theme: 'dark' | 'light' };
  meta: { name: string; version: string };
}
type Mount = (el: HTMLElement, ctx: RemoteContext) => Promise<{ unmount(): Promise<void>; update?(ctx: RemoteContext): void }>;
```

Each remote wraps its framework bootstrap in an adapter: `createApplication` for Angular, `createApp` for Vue, `createRoot` for React. Remotes render inside a shadow root by default. This keeps CSS isolated. The adapter adopts the remote's compiled Tailwind sheet into that root (see D11), and theme values reach in through inherited CSS custom properties. A remote can opt out only for documented reasons.
*Alternative considered*: Angular Elements, or custom elements for every remote. Rejected because a plain function contract is simpler and makes framework-agnosticism explicit.

### D5. Isolation and coexistence

- **Angular runs zoneless** (no zone.js). Zone.js patches global async APIs, which would leak into the React and Vue remotes.
- **No framework runtime is shared** across remotes. Only `libs/mfe-contract` is declared `shared` as a singleton, and correctness never depends on that sharing (see D6).
- **Each mount is wrapped in a timeout** (default 8 s) and try/catch. On failure the shell leaves the pre-rendered DOM in place, adds a small notice, and publishes `remote:error`.
- **Remotes mount lazily** as their slot approaches the viewport (IntersectionObserver). Routed detail views mount immediately. Before mounting any remote, the shell waits until the shared `ui` components are defined (D12).

### D6. Event bus over a window-scoped EventTarget

The bus is a thin typed wrapper around one `EventTarget` stored at `globalThis.__befreemanBus__`, created on first access. Duplicate bundled copies therefore share the same channel. The event catalog is a Zod schema map with a `v` contract version.

| Event | Payload | Publisher |
|---|---|---|
| `nav:request` | `{ path }` | any |
| `route:changed` | `{ path, subPath }` | shell only |
| `entity:focus` | `{ type, id }` | any |
| `theme:changed` | `{ theme }` | shell |
| `remote:error` | `{ name, version, phase, message }` | shell |

Payloads are validated on publish. Invalid events are dropped, with a dev-only warning. `subscribe` returns a disposer, and the mount adapters dispose of all subscriptions on unmount. The future agent will publish `nav:request` and `entity:focus`, with no new mechanism needed.
*Alternative considered*: a shared store such as nanostores. Rejected because events are enough for this domain, and a store invites hidden coupling.

### D7. Content package

- **Authoring**: content lives in `libs/content/content/` as Markdown with YAML frontmatter, organized as `profile.md`, `roles/*.md`, `achievements/*.md`, `case-studies/*.md`, and `skills.yaml`. The Markdown body holds long-form narrative.
- **Validation**: Zod schemas per entity. The validator checks schemas, unique IDs, reference integrity, and required impact statements. It runs as an Nx target that is a dependency of every build.
- **Placeholders**: entities with `placeholder: true` are counted and reported (the spec requires this).
- **Bundle**: the output is `content.<hash>.json` plus a pointer in the manifest (`content: { url, version }`). The shell fetches it once and passes it to remotes through the context, so content fixes need no remote redeploy.
- **Agent readiness**: the package also exports a `toCorpus()` helper that turns content into chunks with entity IDs. The agent change will use it for retrieval and citations. Here it is only implemented and unit-tested.

### D8. Pre-rendering and progressive enhancement

`tools/prerender` runs after the content and shell builds. It renders `/`, `/achievements/<id>`, `/timeline`, `/skills`, and `404.html` from the content bundle with plain TS template functions. The output is semantic HTML using the same Tailwind utility classes, written into the shell's `index.html` template slots. The shell's Tailwind build lists the pre-render templates as an `@source`, so those classes exist in the global sheet. An inline head script sets `data-theme` from the stored choice or the system preference before first paint, which prevents a flash of the wrong mode.

Each page also gets:
- the title, description, canonical URL, OG/Twitter tags, and a generated OG image (Satori → PNG at build time);
- JSON-LD `Person` on the home page;
- `sitemap.xml` and `robots.txt`.

Each slot reserves its final dimensions (CSS `min-block-size` per section) so remote takeover stays within CLS ≤ 0.1.
*Alternative considered*: framework SSR per remote. Rejected because it needs three SSR runtimes at the edge, and the cost is far beyond the SEO benefit for a content site.

### D9. Cloudflare topology

- **One Worker (`apps/edge`) on `befreeman.com`** using Workers Static Assets for the shell and pre-rendered pages. It routes:
  - `/remotes/<name>/<version>/*` to an **R2** bucket. These responses are immutable, with `Cache-Control: public, max-age=31536000, immutable`.
  - `/content/*` to R2, also immutable.
  - `/mfe-manifest.json` to **KV** key `manifest:live`, with `Cache-Control: no-cache` and an ETag.
- **The manifest is a single JSON document**: `{ v, shell, content, ui, remotes: { name: { version, entry, framework } } }`. Writing one KV key keeps promotion atomic. Every promotion also records the previous manifest under `manifest:history:<timestamp>` for rollback and auditing.
- **The Worker sets the CSP** to `script-src 'self'`, with no third-party scripts in this change. Because everything is same-origin, CORS is not needed.
- **The Worker leaves route space for the future agent**, at `/api/*`, unused for now.

*Alternatives considered*:
- A separate Pages project per remote. Rejected because cross-origin delivery complicates CSP and caching.
- Pages Functions instead of a Worker. Rejected because a Worker is more explicit and will also host the agent API.

### D10. Release flow (`tools/release`)

- **`publish-remote <name>`**: builds, computes the version (`<semver>-<shortsha>`), and refuses to run if the R2 prefix already exists. It then uploads to R2.
- **`promote <name> <version>`**: runs the Playwright smoke spec against a preview URL. The Worker accepts a `?mfe-override=<name>@<version>` query param, honored only with a signed preview token. If the smoke spec passes, the command writes the new manifest to KV.
- **`rollback <name> [version]`**: rewrites the manifest from history or to an explicit version.

CI runs on Bitbucket Cloud Pipelines (see D16). Once Cloudflare is set up, merges to `main` publish and promote each affected remote; the shell, the `ui` component library, and the content bundle follow the same publish and promote pattern. `ui` promotion also runs every live remote's smoke check against the candidate version.

### D11. Design system on Tailwind CSS v4 across Shadow DOM

`libs/design-system` holds the token source in TypeScript. It is the single source because the canvas radar and the Satori social preview images need token values in JS. A generator emits:

- **`theme.css`**: Tailwind v4 `@theme` mapping utilities to *semantic* variables (`--color-surface`, `--color-ink`, `--color-accent`, and so on), plus the type, spacing, radius, shadow, and motion scales.
- **`modes.css`**: semantic variable values for `:root[data-theme="light"]` and `:root[data-theme="dark"]`. Tailwind's `dark:` variant is deliberately not used. Selector-based variants cannot cross shadow boundaries, but custom properties inherit into shadow roots. Flipping `data-theme` on `<html>` therefore re-themes every remote instantly, with no per-remote logic, which meets the spec's "switch together, no reload" requirement.
- **`document.css`**: page-level-only rules the shell loads globally. These are `modes.css`, font-face declarations, and the `@property` registrations Tailwind v4 relies on (transforms, gradients, shadows). `@property` is ignored inside shadow roots.
- **`base.css`**: Tailwind preflight plus element defaults. It goes into every shadow sheet, because document-level preflight does not reach inside.

Each remote and the shell have their own `styles.css` that does `@import "tailwindcss"` and the shared `theme.css`/`base.css`, with `@source` pointing at their own templates. The CSS is compiled with `@tailwindcss/postcss` for the Rspack builds (shell, React, Angular) and `@tailwindcss/vite` for Vue. Each remote ships only the utilities it uses.

The compiled CSS is imported as a string. The `createShadowStyles(cssText)` helper turns it into a cached `CSSStyleSheet` that the mount adapter adds to `shadowRoot.adoptedStyleSheets`.

The package also provides motion primitives: duration and easing tokens, plus a `prefersReducedMotion()` helper and Tailwind `motion-safe:`/`motion-reduce:` conventions. Every remote must route animations through these, so reduced motion is honored everywhere. Bold visuals such as the canvas radar, timeline scroll choreography, and hero motion are built on these primitives.

*Alternatives considered*:
- Tailwind in the light DOM with per-remote prefixes. Rejected because it gives up the isolation already chosen.
- UnoCSS. Rejected because its ecosystem and hiring-signal value are smaller.
- Bootstrap. Rejected because it looks generic and is harder to make bold.

### D12. Shared UI components as Lit custom elements

`libs/ui-components` implements `bf-button`, `bf-card`, `bf-chip`, `bf-dialog`, and `bf-theme-toggle` as Lit elements. Each renders in its own shadow root and adopts a Tailwind sheet compiled from the same theme. Custom elements are the only component model all three frameworks consume natively.

- **Delivery**: the library is built as its own artifact and released like a remote, under the manifest entry `ui: { version, entry }`. The shell loads it once and awaits `customElements.whenDefined` for every component before mounting any remote. This meets the spec's "ready before remotes mount" requirement. Remotes import **types only**, never the runtime.
- **Single registry**: a page can define each tag only once, and two bundled copies would throw or skew versions. All definitions go through a guarded `defineOnce` helper, and lint forbids remotes from importing the runtime entry.
- **Framework typings**: a Custom Elements Manifest is generated at build time. From it come React JSX `IntrinsicElements` declarations, Vue `GlobalComponents` declarations, and Angular usage through `CUSTOM_ELEMENTS_SCHEMA` with typed wrapper notes. Events are standard `CustomEvent`s with `bf-` prefixes.
- **Accessibility**: the dialog uses native `<dialog>` for focus trapping and Escape handling. Every component has axe and keyboard tests in both modes.
- **Compatibility**: component APIs follow semver. A breaking change requires a major version, plus a check that every live remote still passes its contract tests against the new `ui` version before promotion.

*Alternatives considered*:
- Per-framework component libraries (Angular Material, Vuetify, MUI). Rejected because three separate looks defeat consistency.
- DaisyUI class components. Rejected because they are CSS only, so behavior such as dialog focus management would be reimplemented three times.

### D13. Theme mode switching

The shell owns the mode. On toggle it sets `data-theme` on `<html>`, persists the choice to `localStorage` (wrapped in try/catch, falling back to the system preference), and publishes `theme:changed`. Remotes only need that event for JS-drawn visuals such as canvas, since CSS follows automatically.

### D14. Testing strategy

- **Vitest** for libraries and the shell. Each framework's own unit runner also works with Vitest: Angular via Analog's Vitest plugin, and `@testing-library/*` for React and Vue.
- **Contract tests**: each remote has a test that mounts it into JSDOM through the real `mount`, asserts that it renders, unmounts it, and asserts that it left nothing behind (no DOM, no bus listeners).
- **Playwright e2e** against the composed build covers the cross-remote scenarios in the specs: deep links, focus propagation, failure isolation (via a blocked route), reduced motion, and the 375px viewport.
- **axe-core** checks every page for WCAG 2.2 AA.
- **Lighthouse CI** (`nx run e2e:lighthouse`, against the compose server) fails the build if CLS goes above 0.1 on any page, or if a page exceeds its script or stylesheet budget. Each remote has its own page (`/achievements`, `/timeline`, `/skills`), so those page budgets act as per-remote JS budgets. Budgets live in `apps/e2e/budgets.json` and are measured uncompressed, because the compose server doesn't compress.
- **Per-remote CSS budgets** are checked in Playwright (`tests/budgets.spec.ts`). Remotes compile their CSS into JS and adopt it into their shadow root, so Lighthouse only sees those bytes as script. The test measures the CSS in each shadow root.

### D15. Federation spike outcome (task 2.1, 2026-11-12)

**Result: the primary approach (D3) works, so no fallback is needed.** A framework-neutral Rspack host using `createInstance` / `registerRemotes` / `loadRemote` from `@module-federation/enhanced/runtime` loaded and mounted all three remotes together in headless Chromium, with zero console errors.

Findings that shape the implementation:
- **Angular's output is ES modules.** `@nx/angular-rspack` emits ESM output (`import.meta`), so the Angular remote must set the MF option `library: { type: 'module' }` and be registered with `type: 'module'`. Vite remotes are always ESM. The React remote uses the default script entry. The manifest therefore carries an entry `type` per remote.
- **`createConfig` requires an `index` HTML file**, because disabling it is unsupported. The Angular remote keeps a tiny `src/index.html` and a dev-only `main.ts`; the shell only ever loads `./mount`. `outputPath.browser: ''` is not honored, so the config overrides `output.path` directly.
- **Angular 22 requires TypeScript `>=6.0 <6.1`.** The workspace pins TypeScript 6.0.3, not 7.x. TypeScript 6 errors on the deprecated `baseUrl`, so `tsconfig.base.json` does not use it. Workspace libraries resolve through pnpm `workspace:*` packages instead of `paths`.
- **Host environment.** Node 22.23 LTS and pnpm 10.34 on this machine. Node binaries installed via snap drop stdout unless it is piped, which only matters for local scripting.

Pinned versions:

| Package | Version |
|---|---|
| nx, @nx/* | 24.0.6 |
| typescript | 6.0.3 |
| @rspack/core, @rspack/cli | 2.3.2 |
| @module-federation/enhanced, /runtime | 2.9.3 |
| @module-federation/vite | 1.23.11 |
| vite | 8.3.8 |
| @angular/* | 22.2.6 (zoneless) |
| react, react-dom | 19.3.1 |
| vue | 3.5.45 |
| @playwright/test | 1.65.0 |

### D16. CI on Bitbucket Cloud Pipelines (free plan)

The repository is hosted on Bitbucket Cloud, so CI is `bitbucket-pipelines.yml`. The free plan includes **50 build minutes per month**. A full run (install, build, browser and Worker tests, e2e) takes roughly 6–10 minutes, so work is scaled to the trigger:

| Trigger | Runs |
|---|---|
| `pull-requests: '**'` | `nx affected -t lint typecheck test build --base=origin/$BITBUCKET_PR_DESTINATION_BRANCH`; no e2e |
| `branches: main` | affected checks against `HEAD~1`, then the Playwright suite (with axe audits) and Lighthouse CI against the local compose server |
| `custom: full` (manual) | everything: `run-many` for all targets, plus e2e and Lighthouse CI |
| deployment steps (follow-up change) | on `main`: publish and promote to the `staging` deployment environment; `production` behind `trigger: manual` |

- **Image**: the official Playwright image (`mcr.microsoft.com/playwright:v1.65.0-noble`), so Chromium and its system dependencies are preinstalled; pnpm is installed in the step.
- **Caching**: custom caches for the pnpm store and `.nx/cache`, keyed on `pnpm-lock.yaml`, so unchanged projects are nearly free.
- **Clone depth**: `clone: depth: full`, which `nx affected` needs to compare against the base branch.
- **Secrets**: Cloudflare credentials and `PREVIEW_SECRET` become secured deployment variables on the `staging` and `production` environments; no CI step before deployment needs them.
- **No Cloudflare in CI checks**: e2e, axe, and Lighthouse run against the local compose server, so CI is useful before any cloud resources exist.

*Alternatives considered*:
- GitHub Actions. Rejected because the repository lives on Bitbucket.
- Bamboo or Jenkins. Rejected because they need self-hosting; Pipelines is built into Bitbucket Cloud.
- Running e2e on every PR. Rejected because it would exhaust the free minutes after about five PRs.

## Risks / Trade-offs

- [Angular + Rspack + MF is the least mature combination] → Spike it first (task group 2). Fallback: build Angular as a standalone ESM bundle exposing `mount`, loaded through the MF runtime's custom-entry support, which keeps the same contract.
- [The free plan cannot enforce merge checks (a Premium feature), so a PR with a red pipeline can still be merged] → Branch restrictions on `main` (no direct pushes), the pipeline status shown on every PR, and the `main` pipeline running the full e2e suite after merge.
- [50 build minutes per month runs out] → Tiered triggers (D16), Nx affected plus caching, and the manual `full` pipeline instead of e2e on every PR. If it still runs short: Nx remote caching or a paid plan.
- [Version churn across `@module-federation/vite`, Rspack, and Nx plugins] → Pin exact versions and let Renovate group MF-related updates. The contract tests catch breakage.
- [Three framework runtimes increase page weight] → Remotes mount lazily on viewport approach, and pre-rendered HTML gives an instant first paint. Per-remote JS budgets are enforced in CI.
- [Shadow DOM interferes with some libraries, such as portals and global styles] → Remotes may opt out with a documented reason. Theme values use CSS custom properties, which pierce shadow roots.
- [Tailwind v4 `@property` registrations are ignored inside shadow roots, so some utilities break silently] → Register them at page level in `document.css`. A Playwright computed-style test covers transform, gradient, and shadow utilities inside a remote.
- [Each remote repeats preflight and overlapping utilities in its own sheet] → Accept some duplication for isolation, and enforce a per-remote CSS budget in CI. Constructable sheets are parsed once per remote.
- [Duplicate custom element definitions or version skew between remotes] → Only the shell loads `ui`, `defineOnce` guards registration, and lint blocks runtime imports in remotes.
- [Pre-rendered HTML appears before `ui` loads] → Pre-rendered markup uses plain semantic elements with the same utility classes, not `bf-*` tags, so it is fully styled without the components.
- [Pre-rendered content and remote content drift apart] → Both read the same content bundle version, pinned in the manifest. An e2e check compares the facts in each.
- [The preview override parameter could be abused to load arbitrary versions] → Only versions in R2 are loadable, and an HMAC-signed preview token is required.
- [The public site launches with placeholder content] → The build warns on placeholders, and the plan is to import real content before DNS cutover.

## Migration Plan

There is no existing site in this repo. Steps:
1. Deploy to a `*.workers.dev` or staging subdomain.
2. Import real content (follow-up).
3. Point `befreeman.com` DNS at the Worker route.

**Rollback**: per remote, by manifest. For the whole site, redeploy the previous Worker version with `wrangler rollback`.

## Open Questions

- Should the OG preview image include a photo of Brian? This can be added later through the content profile.
- What analytics, if any, should the site use (for example Cloudflare Web Analytics, which needs no script changes to the CSP)? This can be decided before launch.
