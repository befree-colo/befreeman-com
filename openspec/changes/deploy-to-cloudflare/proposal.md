# Proposal

## Why

The platform is built and verified locally, but befreeman.com is not live. The Worker, the release tool, and the runbook exist; what's missing is the Cloudflare resources, a way to deploy from CI without spending build minutes on every merge, a verified staging environment, and the domain pointing at the Worker.

## What Changes

- Create the Cloudflare resources for **staging** and **production**:
  - R2 buckets;
  - KV namespaces, with their IDs in `apps/edge/wrangler.jsonc`;
  - the `PREVIEW_SECRET` Worker secret;
  - a scoped API token for CI.
- Add two **manually triggered** Bitbucket custom pipelines, `deploy-staging` and `deploy-production`. Nothing deploys on merge, which keeps the free plan's 50 build minutes for checks.
  - Each deploy publishes and promotes only the parts that changed since that environment's last deploy, then deploys the Worker.
  - Credentials are secured variables visible only to the deployment steps.
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
- Deploy on merge. It can be added later if build minutes allow.
- Paid Cloudflare features. Everything here fits the free plans.

## Capabilities

### New Capabilities
- `site-hosting`: how the public site is reached: the production domain, HTTPS, the `www` redirect, and DNS that preserves the domain's other services.

### Modified Capabilities
- `remote-deployment`:
  - Releases happen through manually triggered deploy runs, not on every merge.
  - Adds staging and production environments with scoped credentials.
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
  - `bitbucket-pipelines.yml`: two custom pipelines;
  - `docs/operations.md`.
- **CI minutes**: deploys spend minutes only when someone runs them. Estimated 4–6 minutes per run.
- **Secrets**: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `PREVIEW_SECRET` as secured Bitbucket deployment variables. None go in the repository.
