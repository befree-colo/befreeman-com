# Operations: deploying befreeman.com

This runbook covers the Cloudflare resources, the secrets they need, and how to publish, promote, and roll back each independently released part of the site.

## How it fits together

| Piece | Built by | Stored in | Goes live when |
|---|---|---|---|
| Shell + pre-rendered pages | `nx run prerender:run` | Worker static assets (`dist/apps/shell`) | `wrangler deploy` |
| Remotes: `achievements` (Angular), `timeline` (Vue), `skills` (React) | `nx build remote-*` | R2 `remotes/<name>/<version>/` | the manifest points at that version |
| Shared UI components (`ui`) | `nx build ui-components` | R2 `ui/<version>/` | the manifest points at that version |
| Career content | `nx run content:bundle` | R2 `content/content.<hash>.json` | the manifest points at that hash |
| Deployment manifest | `release` tool | KV `manifest:live` | a single KV write (atomic) |

The Worker (`apps/edge`) runs first on every request:
- it serves `/mfe-manifest.json` from KV, with `no-cache` and an ETag;
- it serves `/remotes/*`, `/ui/*`, and `/content/*` from R2 with `immutable` caching;
- it reserves `/api/*`;
- it serves everything else from the static assets;
- it adds the CSP (`script-src 'self'`) and security headers to every response.

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

To serve the site on `befreeman.com`, add the domain to the Cloudflare account. Then attach it to the `befreeman-edge` Worker as a custom domain (Workers → befreeman-edge → Settings → Domains & Routes). Staging is reachable at its `*.workers.dev` URL.

### API token for CI

Create a token with **Workers Scripts: Edit**, **Workers KV Storage: Edit**, **Workers R2 Storage: Edit**, and **Account Settings: Read**. Add these GitHub Actions secrets to the repository:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | the token above |
| `CLOUDFLARE_ACCOUNT_ID` | the account id |
| `PREVIEW_SECRET` | the same value given to `wrangler secret put PREVIEW_SECRET --env staging` |

## Commands

All release commands run from the repository root:

```bash
pnpm release <command> [--local | --remote] [--env staging]
```

`--local` is the default. It reads and writes the same local storage that `pnpm nx serve edge` (`wrangler dev`) serves, so you can rehearse everything on your machine. `--remote` targets Cloudflare; add `--env staging` for staging.

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
pnpm release status [--remote --env staging]               # the live manifest
curl -sI https://<site>/mfe-manifest.json                  # ETag, cache headers
```

## Rehearsing locally

```bash
pnpm nx run prerender:run && pnpm nx run-many -t build -p remote-achievements remote-timeline remote-skills ui-components
printf 'PREVIEW_SECRET=local-dev-secret\n' > apps/edge/.dev.vars     # gitignored
# publish + init as above, without --remote
pnpm nx serve edge                                                    # wrangler dev on :8787
E2E_BASE_URL=http://localhost:8787 pnpm nx run e2e:e2e                # full e2e suite against the Worker
PREVIEW_SECRET=local-dev-secret pnpm release promote timeline <v> --base-url http://localhost:8787
```

`wrangler dev` needs a TTY. In a non-interactive shell, run it under `script -qec "…" /dev/null`.

## Verification log

| Date | Environment | What was verified | Result |
|---|---|---|---|
| 2026-11-13 | local (`wrangler dev` + local R2/KV) | publish ×5, init, the full e2e suite (36 tests) through the Worker, promote with a passing smoke check, a duplicate publish refused, a broken build's promotion refused by the smoke check (live manifest unchanged), rollback | ✅ |
| pending | staging | every command above, run with `--remote --env staging` | ⏳ needs the Cloudflare account set up above |

## Rollback drill

To be recorded after staging exists (task 13.2):
1. Publish a deliberately broken remote (e.g. `--dist` pointing at a build whose `remoteEntry.js` throws).
2. Promote it with `--skip-smoke`.
3. Confirm the site shows that section's static fallback with the "unavailable" notice.
4. Run `pnpm release rollback <name>`.
5. Confirm new page loads use the previous version again.
