# Proposal

## Why

The deploy-to-cloudflare change kept deploys and credentials on the operator's workstation, because the Bitbucket build minutes had run out. The repository now lives on GitHub, where Actions minutes are not a constraint, and since 2026-11-24 deploys have been running from GitHub Actions: a push to `main` deploys staging, and production deploys after an approval. Two `remote-deployment` requirements still say the opposite: "Merging to `main` SHALL NOT deploy anything" and "credentials SHALL NOT be available to any CI pipeline". The specs need to describe what runs.

## What Changes

- **BREAKING** (to the spec, not to the running system): a merge to `main` deploys that commit to staging automatically, after every check on `main` passes. Production is deployed only when a person approves it, and only that same commit.
- Cloudflare credentials and per-environment preview secrets may be held by the CI deploy jobs, but only as secrets of the protected `staging` and `production` environments, which are restricted to `main`. Pull-request builds and the check jobs on `main` still have no access. The API token is scoped to this account's Workers scripts, KV and R2, and to Workers routes on the `befreeman.com` zone.
- Re-running the workflow by hand on `main` (optionally releasing every part) covers the cases the "someone starts a deploy run" wording used to: the first deploy after a rollback, or a full re-release. The workstation script stays as a fallback with the same guards.
- The production check for staging's verification waits for staging's marker to become visible (Workers KV is eventually consistent), and says so when the job's credentials cannot see staging's store at all instead of reporting the commit as unverified.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `remote-deployment`: "Manually triggered deploys" becomes automatic staging deploys from `main` plus an approval gate for production; "Deployment credentials are scoped" allows the protected CI deploy environments to hold the credentials while keeping them away from pull-request and check jobs; "Production receives what staging verified" gains the eventual-consistency and wrong-account behavior.

## Impact

- Specs: `openspec/specs/remote-deployment/spec.md` (three requirements).
- Already implemented: `.github/workflows/ci.yml`, `.github/actions/setup/action.yml`, `tools/deploy/deploy.sh`, `tools/release/src/{deploy,stores,cli}.ts`, `docs/operations.md`. This change records and verifies them; it adds no new behavior.
- GitHub settings: the `staging` and `production` environments, their secrets, the required reviewer on `production`, and the `main`-only deployment branch rule are part of the contract and must be checked, since they live outside the repository.
- Order: deploy-to-cloudflare should be archived first. Its specs are already synced into `openspec/specs`, so this change's deltas apply cleanly either way.
