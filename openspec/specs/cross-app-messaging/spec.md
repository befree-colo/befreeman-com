# cross-app-messaging Specification

## Purpose

Defines the typed, versioned event contract that lets the shell and remotes coordinate (navigation, entity focus, route changes, errors) without importing or depending on each other.

## Requirements

### Requirement: Single shared event channel
The shell and all remotes SHALL communicate through one page-wide event channel that works regardless of which framework a participant uses or how many copies of the contract library are bundled.

#### Scenario: Remotes bundling separate copies still communicate
- **GIVEN** two remotes each bundle their own copy of the messaging library
- **WHEN** one remote publishes an event
- **THEN** the other remote's subscriber receives it

### Requirement: Typed and versioned event catalog
Every event SHALL have a name from a published catalog, a payload matching that event's schema, and a contract version. The catalog SHALL cover at least navigation requests, route changes, entity focus, theme changes, and remote errors.

#### Scenario: Valid event is delivered
- **WHEN** a participant publishes `entity:focus` with payload `{ type: "role", id: "<role-id>" }`
- **THEN** all `entity:focus` subscribers receive that payload

#### Scenario: Malformed payload is rejected
- **WHEN** a participant publishes an event whose payload does not match its schema
- **THEN** the event is not delivered to subscribers and a diagnostic is logged in non-production builds

### Requirement: Navigation by request
Remotes SHALL change the top-level route only by publishing a navigation request, and the shell SHALL be the only participant that performs top-level navigation.

#### Scenario: Timeline links to an achievement
- **WHEN** a visitor activates an achievement link inside the timeline remote
- **THEN** the timeline publishes a navigation request for `/achievements/<id>`, the shell navigates, and the shell publishes a route-changed event

### Requirement: Entity focus coordination
When an entity focus event is published, every mounted remote that displays the referenced entity SHALL visually highlight it and bring it into view.

#### Scenario: Focusing a role highlights it across remotes
- **WHEN** an `entity:focus` event for a role is published while the timeline and achievements remotes are mounted
- **THEN** the timeline highlights and scrolls to that role, and the achievements remote highlights achievements linked to that role

#### Scenario: Focus on an entity no remote displays
- **WHEN** an `entity:focus` event references an entity that no mounted remote displays
- **THEN** no error is raised and the page is unchanged

### Requirement: Subscription lifecycle
Subscriptions SHALL be removable, and a remote's subscriptions SHALL NOT receive events after that remote is unmounted.

#### Scenario: Unmounted remote stops receiving events
- **WHEN** a remote is unmounted and an event it had subscribed to is then published
- **THEN** none of that remote's handlers run
