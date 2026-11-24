# Proposal

## Why

The platform is built and verified locally, but befreeman.com is not live. The Worker, the release tool, and the runbook exist; what's missing is the Cloudflare resources, a repeatable way to deploy that doesn't spend Bitbucket build minutes (the free plan's 50 minutes a month don't cover deploy runs), a verified staging environment, and the domain pointing at the Worker.

## What Changes

- Create the Cloudflare resources for **staging** and **production**:
  - R2 buckets;
  - KV namespaces, with their IDs in `apps/edge/wrangler.jsonc`;
  - the `PREVIEW_SECRET` Worker secret.
- Deploy **manually from Brian's workstation** with one script per run, `tools/deploy/deploy.sh <staging|production> [--all]`. Nothing deploys on merge, and Bitbucket runs only the checks.
  - The script deploys only a clean, pushed commit that is already on `origin/main`.
  - Each deploy publishes and promotes only the parts that changed since that environment's last deploy, then deploys the Worker.
  - Each successful deploy pushes a `deployed/<env>/<UTC timestamp>` git tag as the audit trail.
  - Credentials stay on the workstation: a `wrangler login` session and the preview secrets in Brian's password manager. Bitbucket holds no Cloudflare credentials.
- Remove the `deploy-staging` and `deploy-production` Bitbucket custom pipelines added earlier in this change.
- Record the last deployed commit per environment, so a deploy run knows what changed.
- Mark staging as not for search engines (`X-Robots-Tag: noindex`), so it never competes with befreeman.com in search results.
- Verify on staging:
  - every release command;
  - the full Playwright suite against the real Worker;
  - a rollback drill.
- Move befreeman.com's DNS to Cloudflare, keeping every existing record, including the domain's email (MX, SPF, DKIM).
- Attach `befreeman.com` to the production Worker, and redirect `www.befreeman.com` to it.

### Out of scope

- The contact form that emails Brian without exposing his address. It's a separate change (an `/api/contact` Worker endpoint with spam protection).
- Deploying from CI, on merge or on demand. CI deploy pipelines can come back if build minutes allow.
- Paid Cloudflare features. Everything here fits the free plans.

## Capabilities

### New Capabilities
- `site-hosting`: how the public site is reached: the production domain, HTTPS, the `www` redirect, and DNS that preserves the domain's other services.

### Modified Capabilities
- `remote-deployment`:
  - Releases happen through manual deploy runs from the operator's workstation, never from CI or on merge.
  - Adds staging and production environments; credentials never reach CI or the repository.
  - Production receives only what was verified on staging.
- `discoverability`: non-production environments are excluded from search indexing.

## Impact

- **Infrastructure** (Cloudflare free plans):
  - Workers `befreeman-edge` and `befreeman-edge-staging`;
  - R2 buckets `befreeman-artifacts` and `befreeman-artifacts-staging`;
  - KV `MANIFESTS` for each environment;
  - a Cloudflare zone for befreeman.com.
- **DNS**: befreeman.com's nameservers move from the current host to Cloudflare. Brian makes this change at the registrar.
- **Code**:
  - `apps/edge`: wrangler.jsonc IDs and an environment variable for staging's noindex header;
  - `tools/release`: a record of the last deployed commit;
  - `tools/deploy/deploy.sh`: the workstation deploy script;
  - `bitbucket-pipelines.yml`: remove the two deploy pipelines;
  - `docs/operations.md`.
- **CI minutes**: deploys spend none.
- **Secrets**: a `wrangler login` (OAuth) session on Brian's workstation, and one `PREVIEW_SECRET` per environment kept in his password manager. None go in the repository or in Bitbucket.
