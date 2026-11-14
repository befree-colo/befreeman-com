# microfrontend-composition Specification

## Purpose

Defines how the shell application discovers, loads, mounts, isolates, and reveals independently built remote frontends so that they behave as a single cohesive website.

## Requirements

### Requirement: Runtime remote discovery
The shell SHALL determine which remotes to load, and from which versioned location, by reading a deployment manifest at runtime rather than from locations fixed at build time.

#### Scenario: Shell loads remotes listed in the manifest
- **WHEN** a visitor opens the site and the manifest lists remotes `achievements`, `timeline`, and `skills` with versioned entry locations
- **THEN** the shell loads each remote from the entry location given in the manifest

#### Scenario: New remote version is picked up without redeploying the shell
- **GIVEN** the shell is deployed and unchanged
- **WHEN** the manifest is updated to point `timeline` at a newer version
- **THEN** the next page load renders the newer `timeline` version

### Requirement: Uniform mount contract
Every remote SHALL expose the same framework-agnostic lifecycle: mount into a host-provided element with a context object, and unmount on request, regardless of the UI framework that implements it.

#### Scenario: Shell mounts a remote into its slot
- **WHEN** the shell routes to a section owned by a remote
- **THEN** the shell invokes the remote's mount with the section's container element and a context containing the current route, the career content, and the event bus

#### Scenario: Remote cleans up on unmount
- **WHEN** the shell unmounts a remote
- **THEN** the remote removes its DOM, event listeners, and event bus subscriptions, and leaves no global side effects that affect other remotes

### Requirement: Remote failure isolation
A failure to load or run one remote SHALL NOT prevent the shell or other remotes from rendering.

#### Scenario: Remote entry fails to load
- **WHEN** a remote's entry location returns an error or does not respond within the load timeout
- **THEN** the shell keeps that section's pre-rendered content visible, shows an unobtrusive notice that the interactive version is unavailable, and continues rendering other remotes

#### Scenario: Remote throws during mount
- **WHEN** a remote throws an error while mounting
- **THEN** the shell catches it, restores the section's pre-rendered content, and publishes a remote error event identifying the remote and its version

### Requirement: Framework coexistence
The composed page SHALL run remotes implemented in different UI frameworks at the same time without conflicts in global state, styling, or change detection.

#### Scenario: All three remotes active on one page
- **WHEN** the achievements, timeline, and skills remotes are all mounted on the same page
- **THEN** each remains interactive and styles from one remote do not alter the rendering of another

### Requirement: Shell-owned routing
The shell SHALL own top-level URL routing, assign each top-level path prefix to exactly one remote, and give the owning remote the remainder of the path.

#### Scenario: Deep link to an achievement
- **WHEN** a visitor opens `/achievements/<achievement-id>` directly
- **THEN** the shell mounts the achievements remote with sub-route `<achievement-id>` and the remote displays that achievement

#### Scenario: Unknown route
- **WHEN** a visitor opens a path that no remote or shell page owns
- **THEN** the shell renders a not-found page with navigation back to the home page

### Requirement: Architecture view
The site SHALL provide a visitor-toggleable architecture view that visibly outlines each mounted remote and labels it with its name, implementing framework, and deployed version.

#### Scenario: Visitor enables the architecture view
- **WHEN** a visitor turns on the architecture view
- **THEN** each mounted remote is outlined and labeled with its name, framework, and version from the manifest, and the shell region is labeled as the host

#### Scenario: Architecture view reflects a failed remote
- **WHEN** the architecture view is on and a remote failed to load
- **THEN** that remote's region is labeled as unavailable with the version that was attempted
