# design-system Specification

## Purpose

Defines the shared design system (theme, light and dark modes, and reusable UI components) that gives every section of befreeman.com the same look, feel, and behavior regardless of which framework renders it.

## Requirements

### Requirement: Single shared theme
All sections SHALL be styled from one shared theme (color, typography, spacing, radius, elevation, and motion timing), so framework boundaries are not visible unless the architecture view is on.

#### Scenario: Theme value changes
- **WHEN** a theme value such as the primary accent color changes and the theme is redeployed
- **THEN** the shell and all remotes render with the new value without any remote changing its own styles

#### Scenario: Sections are visually indistinguishable by framework
- **WHEN** headings, body text, and spacing are compared across the achievements, timeline, and skills sections
- **THEN** they use the same font families, type scale, colors, and spacing scale

### Requirement: Light and dark modes
The site SHALL offer light and dark modes. It SHALL default to the visitor's system preference and offer a visible toggle whose choice persists across visits.

#### Scenario: First visit follows system preference
- **WHEN** a visitor whose system prefers dark mode opens the site for the first time
- **THEN** every section renders in dark mode

#### Scenario: Visitor toggles the mode
- **WHEN** a visitor switches from dark to light mode
- **THEN** the shell and every mounted remote switch to light mode together, without a page reload and without a flash of the previous mode

#### Scenario: Choice persists
- **WHEN** a visitor who chose light mode returns later
- **THEN** the site opens in light mode regardless of system preference

### Requirement: Shared UI components
A shared set of UI components (at least button, card, chip, dialog, and theme toggle) SHALL be available to every section, with identical appearance and behavior regardless of the framework hosting them.

#### Scenario: Same component in different remotes
- **WHEN** the shared button is rendered in the Angular, Vue, and React remotes with the same variant and label
- **THEN** the three renderings are visually identical and respond to hover, focus, and activation the same way

#### Scenario: Components ready before remotes mount
- **WHEN** any remote mounts
- **THEN** all shared components are already defined and render without an unstyled or unupgraded state

### Requirement: Shared component accessibility
Every shared component SHALL be fully keyboard operable, expose correct roles, names, and states to assistive technology, and meet WCAG 2.2 AA contrast in both light and dark modes.

#### Scenario: Dialog keyboard behavior
- **WHEN** a keyboard user opens the shared dialog
- **THEN** focus moves into the dialog, stays trapped within it, Escape closes it, and focus returns to the element that opened it

#### Scenario: Contrast in both modes
- **WHEN** the automated accessibility check runs on the component catalog in light and in dark mode
- **THEN** it reports no contrast violations

### Requirement: Themed pre-rendered pages
Pre-rendered pages SHALL use the shared theme, so the no-JavaScript view and the first paint already have the final colors, typography, and mode.

#### Scenario: First paint before remotes load
- **WHEN** a page is displayed before any remote has mounted
- **THEN** its content appears in the shared theme and the visitor's mode, and remote takeover does not change colors or typography
