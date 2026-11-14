# Spec Delta

## Purpose

Defines how the shell, each remote, and the content bundle are released independently to immutable versioned locations, promoted to live through the deployment manifest, and rolled back without rebuilding.

## ADDED Requirements

### Requirement: Independent builds
Each remote, the shell, the shared UI component library, and the content bundle SHALL be buildable, testable, and releasable on its own, and a change confined to one of them SHALL NOT require rebuilding or redeploying the others.

#### Scenario: Change only the timeline remote
- **WHEN** a commit modifies only the timeline remote's source
- **THEN** CI builds, tests, and releases only the timeline remote

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
