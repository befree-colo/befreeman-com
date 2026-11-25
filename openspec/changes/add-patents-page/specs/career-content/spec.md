# Spec Delta

## MODIFIED Requirements

### Requirement: Structured career content model
Career content SHALL be organized as typed entities: one profile, plus roles, achievements, case studies, skills, and patents. Each entity SHALL have a stable, unique, URL-safe identifier.

#### Scenario: Entity identifiers are stable references
- **WHEN** an achievement references the role it was earned in by that role's identifier
- **THEN** consumers can resolve the reference to exactly one role

#### Scenario: Patents are delivered with the rest of the content
- **WHEN** the content contains patents and the content bundle is built
- **THEN** the bundle includes every patent, newest issue date first, alongside the profile, roles, achievements, case studies, and skills

## ADDED Requirements

### Requirement: Patents carry their public record
Each patent SHALL include a title, its U.S. publication number, its issue date, its assignee, and a short summary. A patent MAY reference the role it was invented in. The build SHALL fail if a publication number is malformed or used by more than one patent, or if a referenced role does not exist.

#### Scenario: Valid patent
- **WHEN** a patent has a title, publication number `US12530268B2`, issue date `2026-01-20`, assignee `Dell`, and a summary
- **THEN** content validation passes and the patent appears in the content bundle

#### Scenario: Malformed publication number
- **WHEN** a patent's publication number is `12530268` with no country code or kind code
- **THEN** content validation fails and names the offending patent

#### Scenario: Duplicate publication number
- **WHEN** two patents share the publication number `US11841965B2`
- **THEN** content validation fails and names both patents

#### Scenario: Patent references a missing role
- **WHEN** a patent references a role identifier that does not exist
- **THEN** the build fails with an error naming the patent and the missing role identifier
