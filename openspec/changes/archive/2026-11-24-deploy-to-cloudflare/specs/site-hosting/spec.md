# Spec Delta

## Purpose

Defines how visitors reach the public site: the production domain, HTTPS, the `www` redirect, and DNS that keeps the domain's other services working.

## ADDED Requirements

### Requirement: Production domain
The production site SHALL be served at `https://befreeman.com/` by the production edge Worker.

#### Scenario: Visitor opens the domain
- **WHEN** a visitor requests `https://befreeman.com/`
- **THEN** the production Worker responds with the pre-rendered home page and the site's security headers

### Requirement: HTTPS only
The site SHALL be reachable only over HTTPS with a valid certificate, and plain HTTP requests SHALL be redirected to HTTPS.

#### Scenario: HTTP request
- **WHEN** a client requests `http://befreeman.com/timeline`
- **THEN** it receives a permanent redirect to `https://befreeman.com/timeline`

### Requirement: Single canonical host
`www.befreeman.com` SHALL permanently redirect to the same path on `https://befreeman.com`, so search engines and visitors see one host.

#### Scenario: www request
- **WHEN** a client requests `https://www.befreeman.com/skills?x=1`
- **THEN** it receives a permanent redirect to `https://befreeman.com/skills?x=1`

### Requirement: Domain services preserved
Moving the domain's DNS SHALL preserve every existing DNS record that serves something other than the website, including mail delivery (MX) and mail authentication (SPF, DKIM, DMARC), so email to and from the domain keeps working.

#### Scenario: Email after the DNS move
- **WHEN** the domain's nameservers have switched to the new DNS provider
- **THEN** the domain's MX, SPF, DKIM, and DMARC lookups return the same values as before the move, and a test email to an address at the domain is delivered
