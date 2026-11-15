# Design

## Context

- **What already exists** (see proposal.md, Why):
  - The edge Worker (`apps/edge`) already serves the manifest from KV, artifacts from R2, the shell as static assets, and security headers on every response.
  - `wrangler.jsonc` already defines a staging environment, but its KV IDs are still placeholders.
  - The `release` CLI (`tools/release`) already publishes, promotes with a smoke check, rolls back, and reports status, against `--local` storage or `--remote` Cloudflare through Wrangler.
  - Every command has been rehearsed locally (`docs/operations.md`, verification log).
- **Versions:** published versions are `<package version>-<git short sha>`, so two builds of the same commit produce the same version in each environment.
- **Bitbucket free plan:** 50 build minutes a month, and about 26 are already spent this month. Deployment environments and secured deployment variables are available. Deployment permissions are not, so anyone with write access can start a deploy; today that is only Brian.
- **Domain:** befreeman.com is registered and its DNS is hosted outside Cloudflare. The domain also carries email (`brian@befreeman.com`).

## Goals / Non-Goals

**Goals:**
- A deploy is one manual pipeline run per environment. It releases only what changed, and production can only receive a commit that staging verified.
- Everything verifiable is verified in code or tests: the noindex rule, the redirects, and the deploy planner.

**Non-Goals:**
- Preview environments per pull request.
- Infrastructure-as-code (Terraform) for the Cloudflare resources. The one-time resources are few, so the runbook's commands are the record.
- Cloudflare paid features: Workers Paid, Advanced Certificate Manager, or more than the free rule limits.

## Decisions

### D1. Manual Bitbucket custom pipelines, one per environment

`bitbucket-pipelines.yml` gains `custom: deploy-staging` and `custom: deploy-production`. Each has a single step declaring `deployment: staging` or `deployment: production`, so only those steps see that environment's secured variables. Both take an optional `DEPLOY_ALL` pipeline variable to force a full release, for the first deploy or after a rollback.

Brian starts a run from Pipelines → Run pipeline, or from a commit's page to deploy a specific commit.

- *Alternative: deploy on merge (the original TODOS-39 plan).* Rejected by Brian. It would add 4–6 minutes to every merge against a 50-minute monthly budget.
- *Alternative: deploy from a laptop.* Rejected because it puts credentials on a workstation and leaves no audit trail. The release CLI still supports it for emergencies.

### D2. A `release deploy` command plans and runs the whole deploy

All deploy logic lives in a new `release deploy --env <staging|production> --base-url <url>` command. The pipeline step stays a few lines, and the logic is unit-tested against the in-memory stores the release tests already use.

The command does the following, in order:

1. **Read state.** Read `deploy:commit` from the environment's KV (absent on the first deploy).
2. **Plan.**
   - Run `nx show projects --affected --base=<recorded commit> --head=HEAD` and map the results to artifact names: `remote-achievements` → `achievements`, `remote-timeline` → `timeline`, `remote-skills` → `skills`, `ui-components` → `ui`, `content` → `content`.
   - If no commit is recorded, or `--all` is passed, the plan is everything.
   - Nx's project graph already pulls in a remote when a shared library it depends on changes.
3. **Build** only the planned artifacts, plus `prerender:run`. The shell is always rebuilt and deployed. A Worker upload is cheap and idempotent, and the pre-rendered pages embed content, so they must match the live content.
4. **Publish** each planned artifact with `--skip-existing`. A failed run can then be re-run without tripping the immutable-version check.
5. **Promote**, in this order: `ui` first (its smoke check runs against every live remote), then each remote, then content. On the very first deploy, `init` writes the initial manifest instead.
6. **Deploy the Worker** with `wrangler deploy [--env staging]`.
7. **Record the commit.** Write `deploy:commit = <sha>` only after every step above succeeds. Any failure leaves the recorded commit as it was, so the next run retries the same plan.

Staging adds a verification stage: after the deploy, the pipeline runs the Playwright suite against the staging URL. When the suite passes, it writes `deploy:verified:<sha>` to staging's KV.

The production run first checks that this key exists for its commit, by reading staging's KV with the same account token. If it doesn't, the run stops before building anything.

- *Alternative: version artifacts by a hash of their build output,* so unchanged parts are skipped automatically. Rejected for now: it changes the version format the manifest, the smoke check, and the runbook all rely on. Affected-since-last-deploy needs no format change.
- *Alternative: let production read staging's live manifest and copy its versions.* Rejected because production has its own bucket. The artifacts would have to be copied across buckets anyway, and rebuilding the same commit produces identical versions.

### D3. noindex is decided by host, not by environment flag

The Worker adds `X-Robots-Tag: noindex` to every response whose request host isn't the canonical host. The canonical host is `befreeman.com`, set as a `CANONICAL_HOST` var in `wrangler.jsonc`.

This covers staging's `*.workers.dev` URL, production's own `*.workers.dev` URL, and any future preview host, with one rule and no per-environment configuration that could be forgotten. Canonical links are already absolute `https://befreeman.com/...` URLs, built at pre-render time.

### D4. `www` and HTTP redirects live in the Worker

Both `befreeman.com` and `www.befreeman.com` are attached to the production Worker as custom domains (the `routes` entries with `custom_domain: true` in the top-level, production section of `wrangler.jsonc`). Staging keeps only its `workers.dev` URL. The Worker answers:

- a request whose host is `www.befreeman.com` with a 301 to the same path and query on `https://befreeman.com`;
- an `http:` request on the canonical host with a 301 to `https:`.

The zone's "Always Use HTTPS" setting is also turned on, as a second layer.

- *Alternative: Cloudflare Redirect Rules.* They work on the free plan, but they live only in the dashboard. Worker redirects are versioned, reviewed, and unit-tested with the rest of the edge code.

### D5. Move DNS to Cloudflare with a full zone, after a record-by-record comparison

The steps are in this order:

1. Brian adds befreeman.com as a free zone in Cloudflare.
2. Cloudflare's import scans the existing records.
3. Before touching the registrar, export the current host's zone, or list it with `dig` for MX, TXT (SPF and verification records), DKIM selectors, the `_dmarc` record, and CNAMEs.
4. Compare that list with the Cloudflare zone and add anything missing. Mail-related records must be **DNS only** (grey cloud), never proxied.
5. Query Cloudflare's assigned nameservers directly (`dig @<ns>.ns.cloudflare.com befreeman.com MX`) to confirm the answers match, before switching.
6. Lower the TTLs at the current host a day ahead if possible.
7. Brian switches the nameservers at the registrar.
8. Wait for the zone to show **Active**, then attach the custom domains.

- *Alternative: a CNAME (partial) setup that keeps the current DNS host.* Rejected because it requires a paid Cloudflare plan.

### D6. Credentials

**One API token** carries:

- account permissions: Workers Scripts Edit, Workers KV Storage Edit, Workers R2 Storage Edit, and Account Settings Read;
- zone permissions on befreeman.com only: Workers Routes Edit, plus the DNS permission that custom-domain attachment needs.

It is stored as `CLOUDFLARE_API_TOKEN` on both Bitbucket deployment environments, so production can read staging's KV for the verification check (D2).

**`PREVIEW_SECRET`** is a separate random value per environment. It is set with `wrangler secret put` and also stored as the matching deployment variable.

Pull-request and branch pipelines declare no deployment, so they can't see any of these variables.

## Risks / Trade-offs

- **[Email outage during the DNS move]** → D5's record comparison and the direct query to the Cloudflare nameservers before the switch. Keep the old host's zone export so the move can be reverted at the registrar. Send a test email right after the switch.
- **[A rollback is followed by a deploy that skips the rolled-back part]** The recorded commit is newer than the live version. → After a rollback, either fix forward with a commit that touches that part, or run the deploy with `DEPLOY_ALL=true`. Documented in the runbook.
- **[Build-minute overrun]** → Deploys are manual. A staging deploy is estimated at about 6 minutes including the e2e run, and production at about 4. The runbook gives the per-run cost so Brian can budget.
- **[Smoke checks hit a cold Worker or a not-yet-propagated KV write]** KV is eventually consistent, about 60 seconds globally. → Promotion smoke checks use a signed preview override that reads R2 directly. The staging e2e run starts only after the promotion steps, and its manifest assertions retry until the new manifest is visible.
- **[Anyone with repo write access can deploy production]** This is a free-plan limit. → Today that is only Brian. Revisit with Bitbucket Premium if collaborators are added.
- **[Free-plan limits]** Workers allow 100k requests a day, KV 1,000 writes a day, and R2 10 GB. → Each deploy makes a handful of KV writes, and the artifacts are a few MB per version. Far below the limits.

## Migration Plan

1. **Resources:** create the R2 buckets, KV namespaces, secrets, and the API token. Fill in the KV IDs in `wrangler.jsonc`. Set the Bitbucket deployment variables.
2. **Merge the code:** the `release deploy` command, the Worker's noindex and redirect rules, and the two custom pipelines. Merging changes nothing live.
3. **First staging deploy:** run `deploy-staging` with `DEPLOY_ALL=true`. It bootstraps the manifest, deploys the Worker, and runs e2e against staging.
4. **Verify on staging:** run every release command remotely, then the rollback drill. Record both in the runbook.
5. **DNS:** move the zone (D5) and confirm email works.
6. **First production deploy:** run `deploy-production` for the verified commit with `DEPLOY_ALL=true`. Check the production `workers.dev` URL, then attach the custom domains with the next deploy, and confirm the redirects and HTTPS.

**Rollback:**
- A single remote, `ui`, or content: `release rollback <name> --remote [--env staging]`.
- The Worker or shell: `wrangler rollback`.
- DNS: switch the nameservers back at the registrar to the exported zone.

## Open Questions

- Which mail provider serves befreeman.com (this decides which DKIM selectors to look for)? Answered by reading the current DNS records during D5. It doesn't change the approach.
- The exact zone permission that custom-domain attachment requires. Confirmed when the token is created. If it's wrong, the first production deploy fails safely before anything changes.
