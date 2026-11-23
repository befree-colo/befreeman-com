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

Run these from `apps/edge` with a logged-in Wrangler (`pnpm exec wrangler login`). There is no API token: Cloudflare access is the operator's Wrangler session, and Bitbucket holds no Cloudflare credentials.

```bash
# R2 buckets (production and staging)
pnpm exec wrangler r2 bucket create befreeman-artifacts
pnpm exec wrangler r2 bucket create befreeman-artifacts-staging

# KV namespaces: copy the printed ids into wrangler.jsonc
# (replace REPLACE_WITH_KV_NAMESPACE_ID and REPLACE_WITH_STAGING_KV_NAMESPACE_ID)
pnpm exec wrangler kv namespace create MANIFESTS
pnpm exec wrangler kv namespace create MANIFESTS --env staging

# Preview-override secret: a separate random value per environment.
# Generate each one, save it in the password manager first (deploys need it), then paste it at the prompt.
openssl rand -hex 32
pnpm exec wrangler secret put PREVIEW_SECRET
openssl rand -hex 32
pnpm exec wrangler secret put PREVIEW_SECRET --env staging
```

R2 has to be enabled once in the dashboard (**R2 → Purchase R2**, which needs a payment method even on the free tier) before `r2 bucket create` works; otherwise it fails with code 10042.

When `r2 bucket create` or `kv namespace create` offers to add the binding to `wrangler.jsonc`, answer **no**: the bindings are already there, and accepting adds a duplicate at the top level, which gives the production Worker the staging bucket. When it asks whether local dev should connect to the remote resource, also answer **no**: `wrangler dev` and `release --local` use local storage.

### Custom domains (`befreeman.com`)

The Worker serves `befreeman.com` and `www.befreeman.com` as Workers custom domains (the `routes` block in `apps/edge/wrangler.jsonc`). Unlike Pages, a Worker custom domain requires the domain to be a zone in the same Cloudflare account, on Cloudflare's nameservers. The move, done 2026-11-23:

1. Dashboard → **Add a domain** → `befreeman.com`, Free plan. Check the imported DNS records, keeping MX and TXT (mail, SPF/DKIM, verification).
2. Change the nameservers at the registrar to the two Cloudflare assigns, and wait for the zone to show **Active**. Until then, a deploy with `routes` fails with `Can't infer zone from route` (code 10082).
3. In **DNS → Records**, delete the imported A, AAAA, and CNAME records for `@` and `www` (the old site's `www` CNAME to `befreeman.pages.dev` caused Error 1016/530). Remove the hostnames from any Pages project that still claims them.
4. Deploy production (`tools/deploy/deploy.sh production --all`). The deploy attaches both hostnames and creates their DNS records (shown as Worker records) and certificates. Don't create or edit those records by hand.
5. Check: `curl -I https://befreeman.com/` returns 200 and `curl -I https://www.befreeman.com/` returns 301 to `https://befreeman.com/`. The domains are listed under **Workers & Pages → befreeman-edge → Settings → Domains & Routes**.

With `routes` set, Wrangler doesn't serve production on `workers.dev`. Staging sets `"routes": []` (routes are otherwise inherited) and is reachable only at its `*.workers.dev` URL.

Browsers that visited the old site may have cached its 301 from `befreeman.com` to `www`. That's harmless now, since `www` redirects back to the apex, but test changes in a private window or with `curl`.

### Deploy URLs

The two URLs at the top of `tools/deploy/deploy.sh` are the smoke-check targets: staging is `https://befreeman-edge-staging.brian-acb.workers.dev` and production is `https://befreeman.com`. The URLs aren't secret.

## Deploying

A deploy is one command per environment, run from the workstation by `tools/deploy/deploy.sh` (see [Deploying from the workstation](#deploying-from-the-workstation)). That script wraps `release deploy`, which can also run directly with `--local` for rehearsal.

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

**After a rollback, the next deploy needs `--all`** (`tools/deploy/deploy.sh <env> --all`), or a commit that touches the rolled-back part. Otherwise the planner sees nothing changed since `deploy:commit` and leaves the rolled-back version live.

`pnpm release status` prints the live manifest and `deploy:commit`.

## Deploying from the workstation

Deploys never run in CI: Bitbucket's free build minutes can't cover them, so Bitbucket runs only the checks. Merging to `main` never deploys.

### Prerequisites

- Node matching `.nvmrc` (same major, same or newer) and the pnpm version in `package.json`'s `packageManager`. The script checks both.
- `pnpm install`, then the Playwright browsers: `(cd apps/e2e && pnpm exec playwright install chromium)`.
- A Wrangler session: `(cd apps/edge && pnpm exec wrangler login)`. Check it with `pnpm exec wrangler whoami`. It's OAuth and can be revoked from the Cloudflare dashboard.
- That environment's `PREVIEW_SECRET` from the password manager, exported only in the deploy shell. Don't put it in a file in the repo or in shell history (for example `read -rs PREVIEW_SECRET && export PREVIEW_SECRET`).
- The deploy URLs set at the top of `tools/deploy/deploy.sh` (see [Deploy URLs](#deploy-urls)).

### Commands

```bash
tools/deploy/deploy.sh staging [--all]       # deploy, Playwright suite against staging, mark-verified
tools/deploy/deploy.sh production [--all]    # refuses unless staging verified this exact commit
```

The script deploys the checked-out commit. Before it builds anything, it stops unless:

- the working tree is clean;
- HEAD is on `origin/main` (it fetches first), so only reviewed, pushed commits are deployed;
- `PREVIEW_SECRET` is set and the deploy URL has been filled in;
- the Node and pnpm versions match;
- Wrangler is logged in.

Then it runs `release deploy --remote` (see [Deploying](#deploying)). For staging it also runs the full Playwright suite against the staging URL and then `release mark-verified`.

The normal flow is: merge to `main` → `git checkout main && git pull` → `tools/deploy/deploy.sh staging` → check staging → `tools/deploy/deploy.sh production` on that same commit.

**A specific commit:** check it out (`git checkout <sha>`) and run the script. It must already be on `origin/main`, and production requires that the same commit passed a staging deploy.

Use `--all` for the first deploy to an environment and for the first deploy after a `release rollback`.

### Audit tags

After each successful deploy the script pushes a lightweight tag `deployed/<env>/<UTC timestamp>` (for example `deployed/staging/20261119-031500`) on the deployed commit. Tag pushes trigger no pipelines. List the history with `git tag -l 'deployed/*' --sort=-refname`. If the tag push fails, the deploy still stands; push the tag later with the command the script prints.

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
- **Publishing an existing version fails without changing anything.** `release deploy` passes `--skip-existing` so re-runs are idempotent.
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
