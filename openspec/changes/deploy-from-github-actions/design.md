# Design

## Context

deploy-to-cloudflare's D1 made `tools/deploy/deploy.sh` the only deploy path, run from the workstation, and its D6 kept Cloudflare access to a `wrangler login` session there, with no API token. Both decisions came from the Bitbucket free plan's 50 build minutes a month (see proposal.md, Why). The repository moved to GitHub on 2026-11-23, and the workflow in `.github/workflows/ci.yml` has deployed staging and production since 2026-11-24. This design replaces D1 and D6. D2 to D5 stand.

## Goals / Non-Goals

**Goals:**
- One deploy implementation: CI and the workstation run the same `deploy.sh` with the same guards.
- Production stays a deliberate act (the reason D1 rejected deploy-on-merge) through an approval, not a manual run.
- No credential reaches a job that runs code from an unreviewed branch.

**Non-Goals:**
- Preview deployments per pull request.
- Restricting the API token by client IP. GitHub-hosted runners have no fixed address range worth allow-listing.
- Rotating secrets on a schedule.

## Decisions

### D1′. GitHub Actions deploys staging on every push to `main`; production after approval

On a push to `main`, the `checks` job runs every project's lint, typecheck, test and build, the e2e suite with axe, and Lighthouse CI. `deploy-staging` needs `checks` and runs `tools/deploy/deploy.sh staging`: the release (D2), the e2e suite against staging, `mark-verified`, and the audit tag. `deploy-production` needs `deploy-staging` and runs `tools/deploy/deploy.sh production` on the same checkout, in the `production` environment, whose required reviewer makes the job wait for approval. A manual workflow run on `main` does the same, with an `all` input that passes `--all` to both deploys.

Each environment has its own concurrency group with `cancel-in-progress: false`, so a newer push queues behind a running deploy instead of interrupting it mid-promotion. All jobs run in the Playwright image matching the pinned `@playwright/test`, so the smoke checks and e2e runs find Chromium without an install step.

`deploy.sh` is unchanged in shape. Its guards (clean tree, HEAD on `origin/main`, `PREVIEW_SECRET` set, pinned Node and pnpm, Wrangler authenticated) hold in CI too, and it stays the workstation fallback.

- *Alternative: keep manual deploys and only move the checks to GitHub.* Rejected: the minutes constraint is gone, and staging-on-merge gives every merged commit an e2e run against the real Worker.
- *Alternative: deploy production on merge too.* Rejected: production stays deliberate; the approval costs one click and shows the staging result first.
- *Alternative: a separate workflow per environment, chained by `workflow_run`.* Rejected: harder to follow, and `needs` already passes the exact commit.

### D6′. Credentials are GitHub environment secrets

The `staging` and `production` environments each hold `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and that environment's `PREVIEW_SECRET`. Both environments are limited to the `main` branch. Only the two deploy jobs name an environment, so pull-request builds and the `checks` job never receive the secrets, and GitHub masks their values in logs.

The API token is created from the "Edit Cloudflare Workers" template and narrowed to this account (Workers Scripts, Workers KV Storage, Workers R2 Storage: Edit) and the `befreeman.com` zone (Workers Routes: Edit, for the custom domains). One token serves both environments, because production must read staging's KV for the verification check (D2). The workstation keeps its `wrangler login` session for fallback deploys.

- *Alternative: repository secrets.* Rejected: any workflow job, including pull-request builds from branches in this repo, could read them.
- *Alternative: separate tokens per environment.* Rejected: production's token would need staging KV access anyway, so the split buys little.

### D7. The production verification check tolerates KV propagation and names the wrong-account case

Staging writes `deploy:verified:<sha>` as its last step, and production reads it seconds later from another Cloudflare location. Workers KV can take about a minute to make a new key visible there, so the remote check re-reads up to 10 times, 10 seconds apart, before refusing. Wrangler reports a missing remote key as a 404, which the store treats as "no value"; any other Wrangler failure stops the deploy with its message.

If the marker is still missing, production also reads staging's `deploy:commit`, which exists after any staging deploy. If that is missing too, the job is almost certainly reading another account (a wrong `CLOUDFLARE_ACCOUNT_ID`, or a token for another account, where every key 404s), and the error says so instead of calling the commit unverified. That exact failure happened on 2026-11-24.

- *Alternative: hand the verification from staging to production as a job output.* Rejected: the workstation fallback has no job outputs, and the KV marker is what makes the guard hold across both paths.

## Risks / Trade-offs

- **[A merged commit reaches staging without a person choosing to deploy it]** → Staging is noindex and not linked from production, and the full check suite has passed first. Production still needs approval.
- **[A workflow change could expose secrets]** Someone could edit `ci.yml` to print or send them. → Workflow changes go through pull requests, the environments accept only `main`, and pull-request runs get no environment. The token's narrow scope limits the damage, and it can be revoked from the dashboard.
- **[Environment secrets drift from the Workers' secrets]** The `PREVIEW_SECRET` in GitHub must equal the one set on each Worker. → The smoke check fails with "preview override not applied" when they differ (as on 2026-11-24), before anything is promoted. The runbook says to set both together.
- **[A workstation deploy races a CI deploy]** Both write `deploy:commit`. → The runbook says not to run the fallback while a CI deploy to that environment is running.

## Migration Plan

Already done: the workflow and composite setup action were merged, the Bitbucket pipeline removed, the environments and secrets created, and staging and production deployed from CI (`4065e45`). What's left is recording it: the spec delta, the runbook (already describes CI deploys), and checking the GitHub settings that live outside the repo. Rolling back means removing the deploy jobs from `ci.yml` and deploying from the workstation; the release tool needs no change.
