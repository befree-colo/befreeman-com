# Proposal

## Why

befreeman.com needs to sell Brian's work as a software engineer and architect, and the site itself should be proof of that skill. A runtime-composed micro frontend platform, with Angular, React, and Vue sections working as one app, makes the architecture visible. That platform has to exist before the planned career agent and its extras can be built on it.

## What Changes

- Set up an Nx monorepo that builds and tests each frontend, shared library, and edge service as its own project.
- Add a framework-neutral **shell** that owns layout, the hero, navigation, and routing. It loads remote sections at runtime from a deployment manifest and does not bundle them.
- Add three independently built and deployed **remotes**, each mounted through one framework-agnostic contract:
  - **Achievements and case studies** (Angular)
  - **Interactive career timeline** (Vue)
  - **Skills and technology radar** (React)
- Add a typed **cross-app event bus** so remotes coordinate without importing each other: navigation requests, entity focus and highlight, route changes, and errors. The future agent will drive the UI through this same contract.
- Add a typed, build-validated **career content package** as the single source of truth. Content files live in the repo, start as clearly marked placeholders, and are consumed by the shell, the remotes, and later the agent.
- Add **crawlable pre-rendered HTML** with meta, Open Graph, JSON-LD `Person` data, and a sitemap, so recruiters and search engines see real content before JavaScript runs.
- Add an **architecture view** that outlines each remote on the live page with its framework and deployed version.
- Add a **Cloudflare edge deployment**. Remotes ship to immutable, versioned paths, and a manifest controls which version is live, so each remote can be promoted or rolled back on its own.
- Add a shared **design system** built on Tailwind CSS v4 for a consistent look and feel across all sections. It includes:
  - one bold, motion-rich theme with full reduced-motion support;
  - light and dark modes with a visitor toggle;
  - a library of framework-agnostic Web Components (button, card, chip, dialog, theme toggle) that every remote uses, whichever framework it is built with.

### Out of scope (planned follow-up changes)

1. `add-career-agent`: a sandboxed, provider-agnostic, grounded Q&A agent with citations, rendered as a new remote. Guardrails: per-IP and per-session rate limits, a global token budget, Turnstile bot protection, anonymized transcript logging with a privacy notice, and prompt-injection hardening with a red-team suite in CI.
2. `add-agent-site-navigation`: the agent drives the UI through the event bus.
3. `add-agent-lead-capture`: the agent collects a recruiter's contact details and forwards them.
4. `add-agent-extras`: a job-fit matcher, a live architecture tour, and an interview persona mode.
5. Importing Brian's real resume, LinkedIn, and write-up material into the content package.
6. `deploy-to-cloudflare`: creating the Cloudflare resources, Bitbucket deployment steps to staging and production, and verification and a rollback drill on staging.

## Capabilities

### New Capabilities
- `microfrontend-composition`: how the shell discovers, loads, mounts, isolates, and shows independently built remotes in one page.
- `cross-app-messaging`: the typed, versioned event contract remotes and the shell use to talk to each other.
- `career-content`: the career content model (profile, roles, achievements, case studies, skills), its validation, and how it is delivered to consumers.
- `career-showcase`: the visitor-facing experience: hero, achievements, timeline, skills radar, contact path, motion, responsiveness, and accessibility.
- `discoverability`: pre-rendered crawlable pages, metadata, structured data, and the sitemap.
- `remote-deployment`: independent, versioned release, promotion, and rollback of the shell, each remote, and the shared component library.
- `design-system`: the shared theme, light and dark modes, and the reusable, accessible UI components that keep every section consistent.

### Modified Capabilities
<!-- None: no existing specs. -->

## Impact

- **Repository**: becomes a pnpm + Nx workspace with `apps/` (shell, three remotes, edge worker) and `libs/` (content, MFE contract and event bus, design system, UI components).
- **Dependencies**: Nx, Angular, React, Vue, the Module Federation runtime and build plugins, Tailwind CSS v4, Lit, a schema validation library, Playwright, Vitest, and Wrangler.
- **Infrastructure**: a Cloudflare account with a Worker that serves the shell as static assets and handles edge routing, R2 for versioned remote assets, and KV for the manifest.
- **CI**: Bitbucket Cloud Pipelines on the free plan (50 build minutes per month). Cloudflare deploy credentials become secured deployment variables once the deployment follow-up lands.
- **Content**: Brian must supply real career material later. Until then the live site shows placeholder content.
