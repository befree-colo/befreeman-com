# Spec Delta

## Purpose

Defines the visitor-facing experience of befreeman.com: how Brian's profile, achievements, career timeline, and skills are presented, along with the motion, responsiveness, and accessibility standards every section must meet.

## ADDED Requirements

### Requirement: Hero introduction
The home page SHALL open with a hero section showing Brian's name, professional headline, a short value statement, and calls to action for viewing achievements and making contact.

#### Scenario: First visit to the home page
- **WHEN** a visitor opens `/`
- **THEN** the hero displays the name, headline, and value statement from the profile content, plus achievement and contact calls to action

### Requirement: Achievements and case studies
The site SHALL list achievements with filtering by technology and role, and SHALL provide a detail view per achievement showing its impact statements, metrics, technologies, role, and any linked case study.

#### Scenario: Filter achievements by technology
- **WHEN** a visitor selects a technology filter
- **THEN** only achievements involving that technology are listed and the filter is reflected in the URL

#### Scenario: Open achievement detail
- **WHEN** a visitor selects an achievement
- **THEN** its detail view shows its impact statements, metrics, technologies, and a link to its role on the timeline

### Requirement: Interactive career timeline
The site SHALL present roles chronologically in an interactive timeline where each role can be expanded to show its responsibilities and linked achievements.

#### Scenario: Expand a role
- **WHEN** a visitor expands a role on the timeline
- **THEN** the role's responsibilities and linked achievements are shown, each achievement linking to its detail view

### Requirement: Skills radar
The site SHALL visualize skills grouped by category with relative proficiency, and selecting a skill SHALL reveal the achievements that demonstrate it.

#### Scenario: Select a skill
- **WHEN** a visitor selects a skill in the radar
- **THEN** the achievements demonstrating that skill are listed with links to their detail views

### Requirement: Contact path
Every page SHALL offer a visible way to contact Brian that does not expose his email address as plain text in the page source.

#### Scenario: Visitor wants to get in touch
- **WHEN** a visitor activates the contact call to action
- **THEN** they are given contact options (such as LinkedIn and an obfuscated or form-based email path) and the raw email address does not appear in the HTML

### Requirement: Reduced motion support
Animations and motion effects SHALL be disabled or replaced with non-motion equivalents when the visitor's system requests reduced motion.

#### Scenario: Visitor prefers reduced motion
- **WHEN** the visitor's operating system has reduced motion enabled
- **THEN** no section plays parallax, auto-animating, or large-movement transitions, and all content remains reachable

### Requirement: Accessibility baseline
All pages SHALL meet WCAG 2.2 AA, including full keyboard operability of interactive visualizations and text alternatives for the timeline and skills radar.

#### Scenario: Keyboard-only navigation of the skills radar
- **WHEN** a keyboard-only visitor tabs into the skills radar
- **THEN** they can move between skills, select one, and reach its demonstrating achievements without a pointer

#### Scenario: Automated accessibility audit
- **WHEN** the automated accessibility check runs against each page
- **THEN** it reports no WCAG 2.2 AA violations

### Requirement: Responsive layout
Every section SHALL be usable from 320px viewport width up to large desktop displays, with no horizontal page scrolling.

#### Scenario: Phone-width viewport
- **WHEN** the site is viewed at 375px width
- **THEN** all sections reflow to a single column with no horizontal page scroll and all controls remain operable
