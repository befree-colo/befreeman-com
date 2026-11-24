# Spec Delta

## Purpose

Defines how the shell, each remote, and the content bundle are released independently to immutable versioned locations, promoted to live through the deployment manifest, and rolled back without rebuilding.

## MODIFIED Requirements

### Requirement: Independent builds
Each remote, the shell, the shared UI component library, and the content bundle SHALL be buildable, testable, and releasable on its own, and a change confined to one of them SHALL NOT require rebuilding or redeploying the others.

#### Scenario: Change only the timeline remote
- **WHEN** a commit modifies only the timeline remote's source and a deploy run starts
- **THEN** the deploy run builds and releases only the timeline remote

#### Scenario: Change a shared library
- **WHEN** a commit modifies a shared library used by several projects
- **THEN** CI builds and tests every project that depends on that library

## ADDED Requirements

### Requirement: Deployment environments
The site SHALL have two independent environments, staging and production, each with its own artifact storage, deployment manifest, and preview secret. A release, promotion, or rollback in one environment SHALL NOT change the other.

#### Scenario: Promote on staging
- **WHEN** a new timeline version is promoted on staging
- **THEN** staging serves the new version and production's live manifest is unchanged

### Requirement: Manually triggered deploys
Deploys SHALL run only when a person starts a deploy run for a chosen environment and commit. Merging to `main` SHALL NOT deploy anything. A deploy run SHALL release only a commit with no uncommitted changes that is already on the shared `main` branch, and each successful run SHALL leave a record of the environment, commit, and time in the repository.

#### Scenario: Merge to main
- **WHEN** a pull request is merged to `main`
- **THEN** the checks run and neither environment's live manifest or Worker changes

#### Scenario: Start a staging deploy
- **WHEN** someone starts the staging deploy run for a commit
- **THEN** the run releases that commit's changed parts to staging and promotes them, and the repository records the deploy

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

### Requirement: Deployment credentials are scoped
Cloud credentials and preview secrets SHALL exist only on the deploying operator's workstation, SHALL NOT be available to any CI pipeline, and SHALL NOT be stored in the repository or printed in logs. Each environment SHALL have its own preview secret.

#### Scenario: Pull-request or main build
- **WHEN** a pull-request or `main` pipeline runs
- **THEN** it has no access to Cloudflare credentials or preview secrets
