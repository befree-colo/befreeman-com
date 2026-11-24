# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Manually triggered deploys`
- TO: `### Requirement: Deploys follow main, with production approved`

## MODIFIED Requirements

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
