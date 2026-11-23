# Tasks

## 1. Edge Worker: canonical host, noindex, redirects (D3, D4)

- [x] 1.1 Add a `CANONICAL_HOST` var (`befreeman.com`) to `apps/edge/wrangler.jsonc` and `env.ts`. Make the Worker add `X-Robots-Tag: noindex` to every response whose host differs from it. Verify with Worker unit tests: a staging host gets the header on HTML, assets, manifest, and 404 responses; `befreeman.com` never gets it.
- [x] 1.2 Redirect `www.befreeman.com` to `https://befreeman.com` with the same path and query (301), and redirect `http:` on the canonical host to `https:` (301). Verify with Worker unit tests covering path and query preservation, and that the redirect responses still carry the security headers.
- [x] 1.3 Add production `routes` (custom domains `befreeman.com` and `www.befreeman.com`) to the top-level section of `wrangler.jsonc` only, commented out until DNS is active (task 6.4). Verify with `wrangler deploy --dry-run` for both environments: staging shows no routes, and the config parses.

## 2. Release tool: `release deploy` (D2)

- [x] 2.1 Add a planner that maps `nx show projects --affected --base=<sha> --head=HEAD` to artifact names. With no recorded commit or with `--all`, every artifact is planned. Verify with unit tests on fixture project lists: timeline-only, shared library, content-only, nothing changed, and first deploy.
- [x] 2.2 Add `release deploy --env <staging|production> --base-url <url> [--all]`. It runs build, publish `--skip-existing`, promote (`ui`, then remotes, then content; `init` when there's no live manifest), `wrangler deploy`, and finally writes `deploy:commit`. Verify with unit tests against the in-memory stores: the commit is recorded only on full success, and a failed smoke check leaves the recorded commit and the live manifest unchanged.
- [x] 2.3 Add `release mark-verified --env staging` (writes `deploy:verified:<sha>`). Make `release deploy --env production` refuse to start unless staging holds that key for HEAD. Verify with unit tests: a verified commit proceeds, and an unverified commit stops before any build or publish with the explanatory message from the spec.
- [x] 2.4 Rehearse `release deploy` locally against `wrangler dev` (`--local`): a first deploy, a timeline-only change, and a forced failure. Verify the live manifest and `deploy:commit` with `release status`. Document the command in `docs/operations.md`, including `DEPLOY_ALL` after a rollback.

## 3. Deploy path (D1)

- [x] 3.1 *(Superseded by 3.3–3.5: deploys moved to the workstation.)* Add `custom: deploy-staging`. It's one `deployment: staging` step: setup, `release deploy --env staging --base-url $STAGING_URL`, the Playwright suite with `E2E_BASE_URL=$STAGING_URL`, then `release mark-verified`. It takes an optional `DEPLOY_ALL` variable. Verify the YAML with Bitbucket's validator and confirm `pull-requests` and `main` remain checks-only.
- [x] 3.2 *(Superseded by 3.3–3.5.)* Add `custom: deploy-production`. It's one `deployment: production` step running `release deploy --env production --base-url $PRODUCTION_URL`, with optional `DEPLOY_ALL`. Verify the YAML, and document in `docs/operations.md` how to run either pipeline for a specific commit and what each costs in build minutes.
- [x] 3.3 Remove `custom: deploy-staging` and `custom: deploy-production` from `bitbucket-pipelines.yml`, and update its header comment. Verify the YAML with Bitbucket's validator and that `pull-requests`, `main`, and `custom: full` are unchanged.
- [x] 3.4 Add `tools/deploy/deploy.sh <staging|production> [--all]` (D1): the guards (clean tree, HEAD on `origin/main`, `PREVIEW_SECRET` set, `wrangler whoami`, pinned Node and pnpm), `release deploy --remote`, for staging the Playwright suite and `release mark-verified`, then the `deployed/<env>/<timestamp>` tag push. Verify each guard by running the script in the failing state (dirty tree, unpushed commit, unset secret) and confirming it stops before any build, and with `shellcheck`.
- [x] 3.5 Replace the runbook's "Deploy pipelines" section in `docs/operations.md` with "Deploying from the workstation": prerequisites (`wrangler login`, Node and pnpm versions, Playwright browsers, preview secrets from the password manager), the commands, deploying a specific commit, `--all` after a rollback, and the audit tags. Verify that no remaining text in the runbook or `bitbucket-pipelines.yml` describes CI deploys.

## 4. Cloudflare resources and secrets (D6) — Brian runs the account steps, Claude prepares the commands

- [ ] 4.1 Create the R2 buckets and KV namespaces for both environments, and put the real KV IDs in `wrangler.jsonc`. Verify with `wrangler r2 bucket list`, `wrangler kv namespace list`, and `wrangler deploy --dry-run --env staging`.
- [ ] 4.2 Set a separate random `PREVIEW_SECRET` per environment with `wrangler secret put`. Verify with `wrangler secret list [--env staging]`.
- [ ] 4.3 Run `wrangler login` on the workstation and save each environment's `PREVIEW_SECRET` in the password manager (D6). Verify with `wrangler whoami`, and confirm that Bitbucket's repository and deployment variables contain no Cloudflare credentials or preview secrets.

## 5. Staging: first deploy and verification

- [ ] 5.1 Run `tools/deploy/deploy.sh staging --all`. Verify the run passes, including the e2e suite against staging with CSP under the real Worker headers; that `release status --remote --env staging` shows every part; and that staging responses carry `X-Robots-Tag: noindex`; and that a `deployed/staging/...` tag was pushed.
- [ ] 5.2 Run every release command against staging (`publish`, `promote` with a smoke check, `preview-link`, `status`, duplicate publish refused, `rollback`). Verify by adding a row to the runbook's verification log.
- [ ] 5.3 Rollback drill: publish a deliberately broken remote, promote it with `--skip-smoke`, confirm the static fallback and the "unavailable" notice, then `release rollback`. Verify that new page loads use the prior version, and record the drill in `docs/operations.md`.
- [ ] 5.4 Make a timeline-only commit and run `tools/deploy/deploy.sh staging` without `--all`. Verify from the run's output and `release status` that only the timeline was published and promoted.

## 6. DNS move and production (D5)

- [x] 6.1 Export the current DNS host's befreeman.com zone, and list MX, SPF, DKIM, DMARC, and the other records with `dig`. Save the export in the scratchpad (not the repo). Verify that the list is complete against the current host's dashboard. Done 2026-11-23 without a saved zone export: the imported records were checked with `dig` against the Cloudflare nameservers instead (Google MX and SPF present; no DMARC, tracked as TODOS-56).
- [x] 6.2 Brian adds befreeman.com as a free Cloudflare zone. Compare the imported records with 6.1, add anything missing, and set mail records to DNS-only. Verify with `dig @<cloudflare-ns> befreeman.com MX/TXT`, and DKIM and DMARC lookups, matching 6.1 exactly.
- [x] 6.3 Brian switches nameservers at the registrar. Verify that the zone shows Active, public `dig` answers match 6.1, and a test email to and from the domain is delivered. Done 2026-11-23: zone Active on `kevin`/`itzel`.ns.cloudflare.com, and mail to and from the domain was confirmed working.
- [x] 6.4 Enable "Always Use HTTPS". Uncomment the production custom-domain routes and merge. On the staging-verified commit, run `tools/deploy/deploy.sh production --all`. Verify that `https://befreeman.com/` serves the site with no `noindex` header, that `http://` and `www.` return 301 to the canonical URL, and that the certificate is valid. Done 2026-11-23 from `b46c1fd` (Jira TODOS-55): 200 with no `noindex` and a valid certificate, `http://` and `www.` 301 to `https://befreeman.com`. The Worker issues the `http://` redirect; the dashboard "Always Use HTTPS" setting was not checked.

## 7. Integration check

- [ ] 7.1 Run the Playwright suite against `https://befreeman.com` (`E2E_BASE_URL`). Verify that all tests pass, and record production in the runbook's verification log.

## Workflow follow-up

- Move Jira TODOS-38..41 and TODOS-28 to Done as their task groups complete.
- Archive the change with `openspec-archive-change` after 7.1.
- Next change: the server-side contact form (`/api/contact`).
