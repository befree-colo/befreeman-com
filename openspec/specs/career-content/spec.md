# career-content Specification

## Purpose

Defines the single source of truth for Brian's career information (profile, roles, achievements, case studies, and skills), how it is validated, and how it is delivered to the site and, later, the career agent.

## Requirements

### Requirement: Structured career content model
Career content SHALL be organized as typed entities: one profile, plus roles, achievements, case studies, and skills. Each entity SHALL have a stable, unique, URL-safe identifier.

#### Scenario: Entity identifiers are stable references
- **WHEN** an achievement references the role it was earned in by that role's identifier
- **THEN** consumers can resolve the reference to exactly one role

### Requirement: Achievements carry evidence
Each achievement SHALL include a title, a summary, its associated role, the technologies involved, and at least one impact statement. Quantified metrics SHALL be optional.

#### Scenario: Achievement missing an impact statement
- **WHEN** the content contains an achievement with no impact statement
- **THEN** content validation fails and names the offending achievement

### Requirement: Build-time content validation
The build SHALL fail if any content entity violates its schema, references an identifier that does not exist, or reuses an identifier.

#### Scenario: Dangling reference
- **WHEN** an achievement references a role identifier that does not exist
- **THEN** the build fails with an error naming the achievement and the missing role identifier

#### Scenario: Valid content
- **WHEN** all content entities satisfy their schemas and all references resolve
- **THEN** validation passes and the build produces the content bundle

### Requirement: Single content bundle for all consumers
Validated content SHALL be published as one versioned bundle that the shell, every remote, the pre-rendering step, and future agent services consume, so all of them show the same facts.

#### Scenario: Content update without remote redeploy
- **WHEN** an achievement's text is corrected and only the content bundle is redeployed
- **THEN** every remote displaying that achievement shows the corrected text on the next page load, without being rebuilt

### Requirement: Placeholder content is identifiable
Content that stands in for unsupplied real material SHALL be explicitly marked as placeholder, and production builds SHALL report how many placeholder entities remain.

#### Scenario: Production build with placeholders
- **WHEN** a production build runs while placeholder entities exist
- **THEN** the build succeeds and prints a warning listing the count of placeholder entities by type
