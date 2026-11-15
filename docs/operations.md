# Operations: deploying befreeman.com

This runbook covers the Cloudflare resources, the secrets they need, and how to publish, promote, and roll back each independently released part of the site.

## How it fits together

| Piece                                                                 | Built by                 | Stored in                                | Goes live when                      |
| --------------------------------------------------------------------- | ------------------------ | ---------------------------------------- | ----------------------------------- |
| Shell + pre-rendered pages                                            | `nx run prerender:run`   | Worker static assets (`dist/apps/shell`) | `wrangler deploy`                   |
| Remotes: `achievements` (Angular), `timeline` (Vue), `skills` (React) | `nx build remote-*`      | R2 `remotes/<name>/<version>/`           | the manifest points at that version |
| Shared UI components (`ui`)                                           | `nx build ui-components` | R2 `ui/<version>/`                       | the manifest points at that version |
| Career content                                                        | `nx run content:bundle`  | R2 `content/content.<hash>.json`         | the manifest points at that hash    |
| Deployment manifest                                                   | `release` tool           | KV `manifest:live`                       | a single KV write (atomic)          |

The Worker (`apps/edge`) runs first on every request:

- it serves `/mfe-manifest.json` from KV, with `no-cache` and an ETag;
- it serves `/remotes/*`, `/ui/*`, and `/content/*` from R2 with `immutable` caching;
- it reserves `/api/*`;
- it serves everything else from the static assets;
- it adds the CSP (`script-src 'self'`) and security headers to every response;
- it adds `X-Robots-Tag: noindex` to every response whose host isn't `CANONICAL_HOST` (`befreeman.com`), so staging, `*.workers.dev`, and local hosts are never indexed;
- it redirects `www.befreeman.com` and `http://befreeman.com` to `https://befreeman.com` with the same path and query (301).

Version paths are never overwritten. Promoting or rolling back a version is a single manifest write. Every write records the previous manifest under `manifest:history:<ISO timestamp>`.

## One-time Cloudflare setup

Run these from `apps/edge` with a logged-in Wrangler (`pnpm exec wrangler login`), or with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` set.

```bash
# R2 buckets (production and staging)
pnpm exec wrangler r2 bucket create befreeman-artifacts
pnpm exec wrangler r2 bucket create befreeman-artifacts-staging

# KV namespaces: copy the printed ids into wrangler.jsonc
# (replace REPLACE_WITH_KV_NAMESPACE_ID and REPLACE_WITH_STAGING_KV_NAMESPACE_ID)
pnpm exec wrangler kv namespace create MANIFESTS
pnpm exec wrangler kv namespace create MANIFESTS --env staging

# Preview-override secret (any long random string; the same value goes in CI)
openssl rand -hex 32 | pnpm exec wrangler secret put PREVIEW_SECRET
openssl rand -hex 32 | pnpm exec wrangler secret put PREVIEW_SECRET --env staging
```

To serve the site on `befreeman.com`, move the domain's DNS to Cloudflare (the DNS steps are added to this runbook when the move happens), then uncomment the `routes` block in `apps/edge/wrangler.jsonc`. The next production deploy attaches `befreeman.com` and `www.befreeman.com` to the `befreeman-edge` Worker as custom domains. Staging sets `"routes": []` (routes are otherwise inherited) and is reachable only at its `*.workers.dev` URL.

### API token for CI

Create a token with **Workers Scripts: Edit**, **Workers KV Storage: Edit**, **Workers R2 Storage: Edit**, and **Account Settings: Read**.

CI runs on Bitbucket Cloud Pipelines (see `bitbucket-pipelines.yml`). In the Bitbucket repository, open **Repository settings → Deployments** and add these as **secured** variables on the `staging` and `production` deployment environments. Secured variables are masked in logs and can't be read back after saving.

| Variable                | Value                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | the token above                                                                                                            |
| `CLOUDFLARE_ACCOUNT_ID` | the account id                                                                                                             |
| `PREVIEW_SECRET`        | the same value given to `wrangler secret put PREVIEW_SECRET` for that environment                                          |
| `STAGING_URL`           | `staging` only: `https://befreeman-edge-staging.<subdomain>.workers.dev` (not secret)                                      |
| `PRODUCTION_URL`        | `production` only: the production `workers.dev` URL, then `https://befreeman.com` once the domain is attached (not secret) |

Only steps that declare `deployment: staging` or `deployment: production` can see these variables, so pull-request and `main` builds never have Cloudflare credentials.

## Deploying

A deploy is one command per environment. In normal use the Bitbucket pipelines run it (see [Deploy pipelines](#deploy-pipelines)); it also runs locally for rehearsal or an emergency.

```bash
PREVIEW_SECRET=… pnpm release deploy --env <staging|production> --base-url https://<site> [--all] [--remote]
pnpm release mark-verified --env staging [--remote]     # staging only: HEAD passed e2e
```

`release deploy` does the following, in order, and stops at the first failure:

1. **Production only: check verification.** It refuses unless staging's KV holds `deploy:verified:<HEAD sha>`. That key is written by `mark-verified` after the staging e2e run passes, so production only ever receives a commit staging verified.
2. **Plan.** It reads `deploy:commit` (the last fully deployed commit) from the environment's KV and runs `nx show projects --affected --base=<that commit> --head=HEAD`. Affected projects map to parts: `remote-*` → that remote, `ui-components` → `ui`, `content` → `content`. With no live manifest, no recorded commit, a recorded commit missing from the checkout, or `--all`, the plan is every part.
3. **Build** the planned parts, plus the shell and pre-rendered pages (always).
4. **Publish** each planned part, skipping versions that already exist, so a re-run after a failure is safe.
5. **Promote** in order `ui` → remotes → `content`, each with the smoke check. A part already live at that version is skipped. On a first deploy, `init` writes the manifest instead.
6. **Deploy the Worker and shell** (`wrangler deploy`; skipped with `--local`, where `wrangler dev` serves `dist/apps/shell` directly).
7. **Record** `deploy:commit = HEAD`, only now. A failure anywhere above leaves the old value, so the next run retries the same plan.

With `--remote`, it refuses a dirty working tree.

**After a rollback, the next deploy needs `--all`** (`DEPLOY_ALL=true` in the pipeline), or a commit that touches the rolled-back part. Otherwise the planner sees nothing changed since `deploy:commit` and leaves the rolled-back version live.

`pnpm release status` prints the live manifest and `deploy:commit`.

## Deploy pipelines

Both are manual custom pipelines in `bitbucket-pipelines.yml`. Merging to `main` only runs checks; it never deploys.

| Pipeline            | Deployment environment | What it runs                                                                                                        | Build minutes (estimate)    |
| ------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `deploy-staging`    | `staging`              | `release deploy --env staging`, then the full Playwright suite against `$STAGING_URL`, then `release mark-verified` | ~6 (more with `DEPLOY_ALL`) |
| `deploy-production` | `production`           | `release deploy --env production` (refuses unless staging verified this exact commit)                               | ~4 (more with `DEPLOY_ALL`) |

The estimates are refined from real runs in the verification log. The free plan has 50 minutes a month, shared with the `main` checks (~3 minutes per merge).

**To run one:**

- **Latest commit on a branch:** Pipelines → **Run pipeline** → choose the branch (normally `main`) → choose `custom: deploy-staging` or `custom: deploy-production` → set `DEPLOY_ALL` → **Run**.
- **A specific commit:** Commits → open the commit → **Run pipeline** (in the commit's pipeline panel) → choose the custom pipeline. Production requires that the same commit passed `deploy-staging` first.

The normal flow is: merge to `main` → run `deploy-staging` on `main` → check staging → run `deploy-production` for that same commit.

Set `DEPLOY_ALL=true` for the first deploy to an environment and for the first deploy after a `release rollback` (see [Deploying](#deploying)).

## Commands

All release commands run from the repository root:

```bash
pnpm release <command> [--local | --remote] [--env staging|production]
```

`--local` is the default. It reads and writes the same local storage that `pnpm nx serve edge` (`wrangler dev`) serves, so you can rehearse everything on your machine. `--remote` targets Cloudflare; add `--env staging` for staging. Production is Wrangler's top-level environment, so `--env production` and no `--env` are the same, except for `deploy`, which requires `--env`.

### First deployment (bootstrap)

```bash
pnpm nx run-many -t build -p remote-achievements remote-timeline remote-skills ui-components
pnpm nx run prerender:run                                    # shell + pre-rendered pages + content bundle

pnpm release publish achievements --remote --env staging     # prints VERSION=<semver>-<sha>
pnpm release publish timeline     --remote --env staging
pnpm release publish skills       --remote --env staging
pnpm release publish ui           --remote --env staging
pnpm release publish content      --remote --env staging     # prints the content hash

pnpm release init --remote --env staging \
  --ui <ui-version> --content <content-hash> \
  --remote-version achievements@<v> --remote-version timeline@<v> --remote-version skills@<v>

(cd apps/edge && pnpm exec wrangler deploy --env staging)
```

### Publish

```bash
pnpm release publish <achievements|timeline|skills|ui> [--version <v>] [--skip-existing]
pnpm release publish content [--skip-existing]
```

- Uploads the build output to `remotes/<name>/<version>/` (or `ui/<version>/`).
- The default version is `<package version>-<git short sha>`. A dirty working tree adds a `-dirty…` suffix.
- **Publishing an existing version fails without changing anything.** CI passes `--skip-existing` so re-runs are idempotent.
- Content files are content-addressed, so republishing identical content is refused the same way.

### Promote

```bash
PREVIEW_SECRET=… pnpm release promote <name> <version> --base-url https://<site> [--remote --env staging]
pnpm release promote content <hash> [--remote --env staging]
```

Before switching the manifest, promote runs a **smoke check** in headless Chromium against `--base-url`. It loads the remote's page with a signed preview override (`?mfe-override=<name>@<version>&mfe-exp=…&mfe-token=…`) and requires all of the following:

- the Worker reports `x-bf-preview: applied`;
- the remote's slot reaches `data-remote-state="mounted"`;
- there are no console errors.

A `ui` candidate is checked against **every** live remote. If any check fails, the live manifest is left untouched and the command exits non-zero with the reasons.

To preview a candidate in your own browser, generate a signed link. The Worker only honors links signed with `PREVIEW_SECRET`, and only for versions that exist in R2.

```bash
PREVIEW_SECRET=… pnpm release preview-link timeline <version>
# prints /timeline?mfe-override=…; open https://<site><printed path> (valid for 1 hour)
```

### Roll back

```bash
pnpm release rollback <name>            # the most recent earlier version from history
pnpm release rollback <name> <version>  # an explicit published version
```

Rolling back is one manifest write with no rebuild. The faulty version's files stay in R2, unreferenced.

**Whole-site rollback** (shell or Worker code): `(cd apps/edge && pnpm exec wrangler rollback [--env staging])`.

### Inspect

```bash
pnpm release status [--remote --env staging]               # the live manifest and deploy:commit
curl -sI https://<site>/mfe-manifest.json                  # ETag, cache headers
```

## Rehearsing locally

```bash
pnpm nx run prerender:run && pnpm nx run-many -t build -p remote-achievements remote-timeline remote-skills ui-components
printf 'PREVIEW_SECRET=local-dev-secret\n' > apps/edge/.dev.vars     # gitignored
# publish + init as above, without --remote
pnpm nx serve edge                                                    # wrangler dev on :8787
(cd apps/e2e && E2E_BASE_URL=http://localhost:8787 pnpm exec playwright test)   # full e2e suite against the Worker
PREVIEW_SECRET=local-dev-secret pnpm release promote timeline <v> --base-url http://localhost:8787
```

- Build **before** starting `wrangler dev`, and don't rebuild while it runs. `nx run e2e:e2e` re-runs `prerender:run`, which rewrites `dist/apps/shell`. Wrangler reloads partway through and keeps an incomplete asset list, so pages such as `/timeline` return 404 until you restart it. That's why the suite above runs Playwright directly.
- `wrangler dev` needs a TTY. In a non-interactive shell, run it under `script -qec "…" /dev/null`.
- `wrangler rollback` (whole-site) only works against Cloudflare, so it can't be rehearsed locally.

To rehearse `release deploy`, run it with `--env staging` (the default `--local` target) against a fresh local staging store. It needs real commits, because the planner compares commits: make throwaway commits on a scratch branch and delete it afterwards.

```bash
export $(grep PREVIEW_SECRET apps/edge/.dev.vars)
pnpm release deploy --env staging --base-url http://localhost:8787     # first deploy: init, no smoke check needed
(cd apps/edge && pnpm exec wrangler dev --env staging --port 8787)      # then serve staging's local state
# commit a change, then deploy again: only the affected parts are published and smoke-checked
pnpm release status --env staging
```

Nx's cache leaves `dist/apps/shell` untouched when the shell didn't change, so `wrangler dev` keeps serving through a deploy that only changes a remote.

## Verification log

| Date       | Environment                                                     | What was verified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Result                                       |
| ---------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 2026-11-13 | local (`wrangler dev` + local R2/KV)                            | publish ×5, init, the full e2e suite (36 tests) through the Worker, promote with a passing smoke check, a duplicate publish refused, a broken build's promotion refused by the smoke check (live manifest unchanged), rollback                                                                                                                                                                                                                                                                                                         | ✅                                           |
| 2026-11-13 | local, from empty R2/KV state                                   | the build and `prerender:run`, publish ×5 (3 remotes, `ui`, `content`), `init`, `status`, manifest headers (`no-cache`, ETag, CSP), `preview-link` (the signed link sets the `bf-preview` cookie), duplicate publish refused (exit 1), `--skip-existing` (exit 0), `promote` with a passing smoke check, `promote content`, `rollback` from history and to an explicit version, and the full e2e suite through the Worker (53 tests)                                                                                                   | ✅                                           |
| 2026-11-14 | local staging (`wrangler dev --env staging`, fresh local R2/KV) | `release deploy`: first deploy (publish ×5, `init`, commit recorded); a Worker-only run (nothing affected); a timeline-only commit (only `timeline` built, published, smoke-checked, and promoted, other versions unchanged, `wrangler dev` kept serving); a broken timeline commit (smoke check refused it, exit 1, live manifest and `deploy:commit` unchanged; the re-run planned the same part and skipped the re-publish); production refused an unverified commit (exit 1, before any build) and proceeded after `mark-verified` | ✅                                           |
| pending    | staging                                                         | every command above, run with `--remote --env staging`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | ⏳ needs the Cloudflare account set up above |

## Rollback drill

To be recorded after staging exists (`deploy-to-cloudflare` change):

1. Publish a deliberately broken remote (e.g. `--dist` pointing at a build whose `remoteEntry.js` throws).
2. Promote it with `--skip-smoke`.
3. Confirm the site shows that section's static fallback with the "unavailable" notice.
4. Run `pnpm release rollback <name>`.
5. Confirm new page loads use the previous version again.
