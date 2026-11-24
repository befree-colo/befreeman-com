# remote-deployment Specification

## Purpose

Defines how the shell, each remote, and the content bundle are released independently to immutable versioned locations, promoted to live through the deployment manifest, and rolled back without rebuilding.

## Requirements

### Requirement: Independent builds
Each remote, the shell, the shared UI component library, and the content bundle SHALL be buildable, testable, and releasable on its own, and a change confined to one of them SHALL NOT require rebuilding or redeploying the others.

#### Scenario: Change only the timeline remote
- **WHEN** a commit modifies only the timeline remote's source and a deploy run starts
- **THEN** the deploy run builds and releases only the timeline remote

#### Scenario: Change a shared library
- **WHEN** a commit modifies a shared library used by several projects
- **THEN** CI builds and tests every project that depends on that library

### Requirement: Immutable versioned artifacts
Every released remote build SHALL be stored at a unique versioned location whose contents never change after publication, so a version can always be reloaded exactly as released.

#### Scenario: Re-release attempt to an existing version
- **WHEN** a release tries to publish to a version location that already exists
- **THEN** the release fails without modifying the existing artifacts

### Requirement: Manifest-controlled promotion
A released remote version SHALL become live only when the deployment manifest is updated to reference it. Manifest updates SHALL be atomic and SHALL take effect for new page loads without a shell redeploy.

#### Scenario: Promote a new version
- **WHEN** the manifest entry for `skills` is updated from version A to version B
- **THEN** new page loads use version B and no page load ever receives a manifest mixing partial entries

### Requirement: Pre-promotion verification
A remote version SHALL pass automated smoke checks (entry loads, mount contract satisfied, no console errors on mount) against the composed site before the manifest is updated to reference it.

#### Scenario: Smoke check fails
- **WHEN** a newly released version fails its mount smoke check
- **THEN** the manifest is not updated and the previously live version keeps serving

### Requirement: Rollback
An operator SHALL be able to roll any remote back to a previously released version in one manifest update, without rebuilding anything.

#### Scenario: Roll back a faulty release
- **WHEN** an operator rolls `achievements` back to its previous version
- **THEN** new page loads render the previous version and the faulty version's artifacts remain stored but unreferenced

### Requirement: Same-origin delivery
The shell, remotes, shared UI component library, content bundle, and manifest SHALL be served from the site's own origin so the content security policy can limit script sources to that origin.

#### Scenario: Content security policy enforced
- **WHEN** the site is loaded in a browser
- **THEN** the response's content security policy allows scripts only from the site's own origin, and all remotes load and mount successfully under it

### Requirement: Deployment environments
The site SHALL have two independent environments, staging and production, each with its own artifact storage, deployment manifest, and preview secret. A release, promotion, or rollback in one environment SHALL NOT change the other.

#### Scenario: Promote on staging
- **WHEN** a new timeline version is promoted on staging
- **THEN** staging serves the new version and production's live manifest is unchanged

### Requirement: Deploys follow main, with production approved
A commit SHALL be deployed to staging automatically once it lands on `main` and every check on `main` passes. Production SHALL be deployed only after a person approves it, and only with the commit that run deployed to staging. A deploy SHALL release only a commit with no uncommitted changes that is on `main`, and each successful deploy SHALL leave a record of the environment, commit, and time in the repository.

#### Scenario: Merge to main
- **WHEN** a pull request is merged to `main` and the checks pass
- **THEN** that commit's changed parts are released to staging and promoted, the staging e2e suite runs against staging, and the repository records the deploy

#### Scenario: Checks fail on main
- **WHEN** a check on `main` fails
- **THEN** neither environment's live manifest or Worker changes

#### Scenario: Production waits for approval
- **WHEN** staging has deployed and verified a commit and nobody has approved the production deploy
- **THEN** production's live manifest and Worker are unchanged until a person approves it

#### Scenario: Start a staging deploy
- **WHEN** someone starts the workflow by hand on `main`, optionally asking for every part to be released
- **THEN** the run deploys the head of `main` to staging the same way as a merge, releasing every part when asked, and production again waits for approval

#### Scenario: Deploy uncommitted or unpushed work
- **WHEN** someone starts a deploy with uncommitted changes, or for a commit that is not on the shared `main` branch
- **THEN** the run stops before building anything and explains why

### Requirement: Deploy only what changed since the last deploy
A deploy run SHALL release only the parts whose source changed since the commit last deployed to that environment, and SHALL record the newly deployed commit for that environment only after every promotion in the run succeeds. When the environment has no recorded commit, the run SHALL release every part.

#### Scenario: Timeline-only change since the last deploy
- **WHEN** the only change since staging's last deployed commit is in the timeline remote
- **THEN** the staging deploy run publishes and promotes only the timeline remote and leaves the other live versions unchanged

#### Scenario: A promotion fails
- **WHEN** a promotion's smoke check fails during a deploy run
- **THEN** the run fails, the recorded last-deployed commit is unchanged, and the next run retries the same parts

### Requirement: Production receives what staging verified
A production deploy SHALL release a commit that has already been deployed to staging and verified there, built from the same source.

#### Scenario: Deploy an unverified commit to production
- **WHEN** someone starts the production deploy for a commit that was never deployed to staging
- **THEN** the run stops before releasing anything and explains that the commit must be deployed to staging first

#### Scenario: Staging's verification was just recorded
- **WHEN** production starts within moments of staging recording its verification, before that record is visible everywhere
- **THEN** the production deploy waits a bounded time for the record and proceeds once it appears

#### Scenario: Production cannot read staging's records
- **WHEN** the production deploy's credentials cannot see staging's deployment state at all
- **THEN** the run stops before releasing anything and says that the credentials, not the commit, are the problem

### Requirement: Deployment credentials are scoped
Cloud credentials and preview secrets SHALL be available only to the staging and production deploy jobs, which run only for `main`, and to the deploying operator's workstation for fallback deploys. They SHALL NOT be available to pull-request builds or to the check jobs on `main`, and SHALL NOT be stored in the repository or printed in logs. The cloud credential SHALL be limited to the resources a deploy needs. Each environment SHALL have its own preview secret.

#### Scenario: Pull-request or main build
- **WHEN** a pull-request build, or the check jobs on `main`, runs
- **THEN** it has no access to Cloudflare credentials or preview secrets

#### Scenario: Deploy job outside main
- **WHEN** a workflow run from any branch other than `main` tries to use a deploy environment
- **THEN** it is refused and never receives that environment's secrets

#### Scenario: Secrets in deploy logs
- **WHEN** a deploy job prints a command, its environment, or an error that contains a secret value
- **THEN** the log shows the value masked
