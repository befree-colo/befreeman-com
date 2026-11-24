# Tasks

## 1. GitHub settings (outside the repo)

- [ ] 1.1 Check the `staging` and `production` environments (Settings → Environments): deployment branches limited to `main`, a required reviewer on `production`, and `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `PREVIEW_SECRET` set on each. Verify by screenshot or by listing the names in the runbook's verification log; no repository-level Cloudflare or preview secrets exist (Settings → Secrets and variables → Actions → Repository secrets is empty of them).
- [ ] 1.2 Check the Cloudflare API token's permissions match design D6′ (account: Workers Scripts, Workers KV Storage, Workers R2 Storage Edit; zone `befreeman.com`: Workers Routes Edit) and nothing broader. Verify against the token's summary in the Cloudflare dashboard.

## 2. Workflow behavior

- [ ] 2.1 Confirm a pull-request run has no deploy jobs and no secrets: on any open PR, the run shows only "Affected checks", and its job log has no `CLOUDFLARE_*` or `PREVIEW_SECRET` entries in the environment block.
- [x] 2.2 Confirm a push to `main` deploys staging after the checks and then waits for production approval: on the next merge, the run shows "Deploy staging" succeeded and "Deploy production" waiting for review until approved. Done 2026-11-24: the `51c5e52` run deployed staging after the checks, and production waited for review (rejected, by choice).
- [x] 2.3 Confirm the production check for staging's verification: the release tests in `tools/release/src/deploy.test.ts` pass (`pnpm nx run-many -t lint typecheck test -p release`), covering the wait for a lagging marker, the refusal once the wait runs out, and the "cannot see staging's deploy state" message.

## 3. Documentation

- [x] 3.1 Check `docs/operations.md` describes the CI path ("Deploying from GitHub Actions": token scope, environments, environment secrets, keeping each environment's `PREVIEW_SECRET` equal to its Worker's) and the workstation fallback. Add the PREVIEW_SECRET pairing note if it's missing. Verify by reading the section against design D1′ and D6′.
- [x] 3.2 Run `openspec validate deploy-from-github-actions --strict` and verify it passes.

## Workflow follow-up

- deploy-to-cloudflare was archived on 2026-11-24 (`archive/2026-11-24-deploy-to-cloudflare`); archive this change once its tasks are done.
- Tracked in Jira as TODOS-59 (under TODOS-6); close it when the change is archived.
