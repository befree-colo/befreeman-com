# Spec Delta

## MODIFIED Requirements

### Requirement: Pre-rendered content pages
The home page, every achievement detail page, and the Patents page SHALL be served as pre-rendered HTML that contains that page's primary career content, readable without JavaScript.

#### Scenario: Crawler fetches the home page without JavaScript
- **WHEN** a client without JavaScript requests `/`
- **THEN** the HTML response contains the profile name, headline, summary, role list, and achievement titles

#### Scenario: Crawler fetches an achievement page
- **WHEN** a client without JavaScript requests `/achievements/<id>`
- **THEN** the HTML response contains that achievement's title, summary, and impact statements

#### Scenario: Crawler fetches the Patents page
- **WHEN** a client without JavaScript requests `/patents`
- **THEN** the HTML response contains every patent's title, publication number, and Google Patents link
