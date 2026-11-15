# Spec Delta

## Purpose

Ensures recruiters, search engines, and link-preview services can read Brian's career content without running JavaScript, through pre-rendered pages, rich metadata, structured data, and a sitemap.

## ADDED Requirements

### Requirement: Non-production environments are not indexed
Every response from a non-production environment SHALL tell search engines not to index it, and production responses SHALL NOT carry that instruction. Canonical URLs on every environment SHALL point at the production domain.

#### Scenario: Crawler visits staging
- **WHEN** a crawler requests any page on the staging site
- **THEN** the response includes `X-Robots-Tag: noindex` and the page's canonical URL points at `https://befreeman.com/`

#### Scenario: Crawler visits production
- **WHEN** a crawler requests any page on `https://befreeman.com`
- **THEN** the response does not include a `noindex` instruction
