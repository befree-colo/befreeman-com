# discoverability Specification

## Purpose

Ensures recruiters, search engines, and link-preview services can read Brian's career content without running JavaScript, through pre-rendered pages, rich metadata, structured data, and a sitemap.

## Requirements

### Requirement: Pre-rendered content pages
The home page and every achievement detail page SHALL be served as pre-rendered HTML that contains that page's primary career content, readable without JavaScript.

#### Scenario: Crawler fetches the home page without JavaScript
- **WHEN** a client without JavaScript requests `/`
- **THEN** the HTML response contains the profile name, headline, summary, role list, and achievement titles

#### Scenario: Crawler fetches an achievement page
- **WHEN** a client without JavaScript requests `/achievements/<id>`
- **THEN** the HTML response contains that achievement's title, summary, and impact statements

### Requirement: Progressive enhancement over pre-rendered content
When JavaScript runs, interactive remotes SHALL take over their pre-rendered sections without changing the facts shown, and without layout shift beyond the Core Web Vitals "good" CLS threshold.

#### Scenario: Remote takes over its section
- **WHEN** the achievements remote mounts over its pre-rendered section
- **THEN** the same achievements are shown and cumulative layout shift stays at or below 0.1

### Requirement: Page metadata and social previews
Every pre-rendered page SHALL include a unique title, a meta description, a canonical URL, and Open Graph and Twitter card metadata including a preview image.

#### Scenario: Link shared on a social platform
- **WHEN** an achievement URL is fetched by a link-preview service
- **THEN** the preview uses that achievement's title, summary, and a preview image

### Requirement: Structured data
The home page SHALL embed JSON-LD structured data describing Brian as a `Person`, including name, job title, sameAs profile links, and known skills, all derived from the career content.

#### Scenario: Structured data validation
- **WHEN** the home page's JSON-LD is checked against schema.org `Person`
- **THEN** it parses as valid and its values match the profile content

### Requirement: Sitemap and robots policy
The site SHALL publish a sitemap listing every pre-rendered page and a robots policy that allows indexing of public pages.

#### Scenario: New achievement added
- **WHEN** a new achievement is added to the content and the site is rebuilt
- **THEN** its detail URL appears in the sitemap

### Requirement: Non-production environments are not indexed
Every response from a non-production environment SHALL tell search engines not to index it, and production responses SHALL NOT carry that instruction. Canonical URLs on every environment SHALL point at the production domain.

#### Scenario: Crawler visits staging
- **WHEN** a crawler requests any page on the staging site
- **THEN** the response includes `X-Robots-Tag: noindex` and the page's canonical URL points at `https://befreeman.com/`

#### Scenario: Crawler visits production
- **WHEN** a crawler requests any page on `https://befreeman.com`
- **THEN** the response does not include a `noindex` instruction
