# Spec Delta

## ADDED Requirements

### Requirement: Patents page
The site SHALL provide a Patents page at `/patents`, reachable from the site navigation, that lists every patent newest first. Each entry SHALL show the patent's title, its formatted publication number, its issue date, its assignee, and its summary, and SHALL link to that patent's Google Patents page.

#### Scenario: Visitor opens the Patents page
- **WHEN** a visitor selects "Patents" in the site navigation
- **THEN** `/patents` lists every patent from the content, newest issue date first, and states how many patents there are

#### Scenario: Patent entry links to its public record
- **WHEN** the Patents page shows the patent `US12530268B2`
- **THEN** the entry displays the number as `US 12,530,268 B2` and links to `https://patents.google.com/patent/US12530268B2/en`, opening in a new tab with an accessible name that includes the patent title

#### Scenario: Patent invented in a known role
- **WHEN** a patent references the role it was invented in
- **THEN** its entry links to that role on the career timeline
