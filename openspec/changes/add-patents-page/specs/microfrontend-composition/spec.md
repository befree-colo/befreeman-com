# Spec Delta

## MODIFIED Requirements

### Requirement: Framework coexistence
The composed page SHALL run remotes implemented in different UI frameworks at the same time without conflicts in global state, styling, or change detection.

#### Scenario: All three remotes active on one page
- **WHEN** the achievements, timeline, and skills remotes are all mounted on the same page
- **THEN** each remains interactive and styles from one remote do not alter the rendering of another

#### Scenario: Navigating between remotes built in different frameworks
- **WHEN** a visitor navigates from the skills page (React) to the patents page (Svelte) and back without a full page load
- **THEN** each remote mounts on arrival and unmounts on departure, leaving no DOM, listeners, or styles behind that alter the other

#### Scenario: Svelte remote in the architecture view
- **WHEN** the architecture view is on while the patents remote is mounted
- **THEN** its region is labeled with the name `patents`, the framework `svelte`, and its version from the manifest

## ADDED Requirements

### Requirement: Content sections are remotes
Every page section that presents career content SHALL be implemented by a remote that owns its route prefix and is released independently. The shell SHALL own only the site chrome (header, navigation, footer, contact path, theme, and the home page hero introduction), routing, the not-found page, the architecture view, and the pre-rendered fallback markup that remotes take over.

#### Scenario: A new content page is added
- **WHEN** a page presenting career content, such as patents, is added to the site
- **THEN** it is served by a remote listed in the deployment manifest, mounted through the uniform mount contract over a pre-rendered slot, and not rendered solely by the shell

#### Scenario: The shell renders a route
- **WHEN** the shell matches any route other than the not-found page
- **THEN** that route's career content appears inside at least one remote slot

#### Scenario: Section headings belong to the remote
- **WHEN** a section shows an eyebrow, heading, or introduction for its content, such as "Patents" and its patent count
- **THEN** the remote renders it, and the pre-rendered fallback places it inside that remote's slot rather than in shell markup around the slot
