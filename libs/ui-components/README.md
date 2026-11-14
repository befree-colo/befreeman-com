# @befreeman/ui-components

Shared UI components as framework-agnostic **custom elements** (built with Lit). They look and behave the same in the shell and in every remote: Angular, React, and Vue.

| Tag | What it is | Key properties | Events |
|---|---|---|---|
| `<bf-button>` | button, or link when `href` is set | `variant` (`primary`\|`secondary`\|`ghost`), `size` (`sm`\|`md`\|`lg`), `href`, `target`, `disabled`, `type`, `label` | native `click` |
| `<bf-card>` | content container, or link card with `href` | `variant` (`raised`\|`outline`\|`glow`), `href`, `highlighted` | none |
| `<bf-chip>` | tag, or toggle chip with `interactive` | `interactive`, `selected`, `value` | `bf-toggle` → `{ selected, value }` |
| `<bf-dialog>` | modal on native `<dialog>` | `open`, `close-label`; methods `show()` / `close()` | `bf-close` |
| `<bf-theme-toggle>` | light/dark switch (reports only; the shell applies it) | `theme` (`light`\|`dark`), `label` | `bf-theme-change` → `{ theme }` |

Slots: `bf-card` and `bf-dialog` take `slot="heading"`, a default slot, and `slot="footer"`. `bf-button` takes a default slot and `slot="icon"`.

Accessibility comes built in:
- every control is a native `<button>`, `<a>`, or `<dialog>`;
- `bf-chip` uses `aria-pressed`;
- `bf-theme-toggle` is a labelled `role="switch"`;
- `bf-dialog` moves focus in, makes the page inert, closes on Escape, and returns focus to whatever opened it.

All components pass axe (WCAG 2.2 AA, including contrast) in both modes.

## How it is delivered: load once, never bundle

There is **one custom-element registry per page**, so the components are built as their own artifact (`nx build ui-components` → `dist/libs/ui-components/ui.js`). That artifact is released and rolled back like a remote, under the manifest entry `ui`. The shell loads it once and waits for every tag to be defined before mounting any remote.

**Remotes must never import the runtime** (`@befreeman/ui-components`). Lint enforces this. Remotes import **types only**:

| Import | Use |
|---|---|
| `@befreeman/ui-components/types` | prop and event types (`ButtonVariant`, `ChipToggleDetail`, ...) |
| `@befreeman/ui-components/react` | React 19 JSX typings |
| `@befreeman/ui-components/vue` | Vue `GlobalComponents` typings |
| `@befreeman/ui-components/dom` | `HTMLElementTagNameMap` / `HTMLElementEventMap`; gives Angular typed `$event` |

These typings are generated from the Custom Elements Manifest (`custom-elements.json`) by `nx run ui-components:manifest`. Re-run it after changing a component's public API. A test fails if the committed typings are stale.

## Usage per framework

The snippets below are verbatim excerpts of fixtures that `nx typecheck ui-components` compiles with `tsc`, `vue-tsc`, and `ngc`.

### React 19

React 19 sets properties on custom elements and attaches listeners for props named `on<event-name>`:

<!-- snippet: test/typecheck/react/fixture.tsx -->
```tsx
      <bf-chip interactive selected value="aws" onbf-toggle={onToggle}>
        AWS
      </bf-chip>
```

Reference the typings once in the remote, e.g. in a `global.d.ts`: `/// <reference types="@befreeman/ui-components/react" />`.

### Vue 3

Configure the compiler with `isCustomElement: (tag) => tag.startsWith('bf-')`. Events use the normal `@event` syntax:

<!-- snippet: test/typecheck/vue/Fixture.vue -->
```vue
    <bf-chip interactive :selected="true" value="aws" @bf-toggle="onToggle">AWS</bf-chip>
```

Reference `@befreeman/ui-components/vue`. It also allows the native `slot="..."` attribute on plain elements, which slotting content into web components needs.

### Angular

Add `CUSTOM_ELEMENTS_SCHEMA` to components that use `bf-*` tags, and reference `@befreeman/ui-components/dom`. Under `strictTemplates`, `$event` is then typed:

<!-- snippet: test/typecheck/angular/fixture.component.ts -->
```ts
    <bf-chip interactive value="aws" (bf-toggle)="onToggle($event)">AWS</bf-chip>
```

<!-- snippet: test/typecheck/angular/fixture.component.ts -->
```ts
  onToggle(e: CustomEvent<ChipToggleDetail>): void {
    this.selected = e.detail.selected;
  }
```

## Developing

```bash
pnpm nx test ui-components              # browser tests (Chromium): keyboard, dialog focus, axe in both modes
pnpm nx typecheck ui-components         # library + React/Vue/Angular fixtures
pnpm nx run ui-components:manifest      # regenerate custom-elements.json and types/
pnpm nx run ui-components:verify-artifact  # build ui.js and check it defines every tag in a blank page
```

To add a component:
1. Create `src/components/<name>.ts` extending `BfElement`, with a `@tagname bf-<name>` JSDoc tag.
2. Register it in `src/register.ts`.
3. Export its public types from `src/types.ts`.
4. Run `manifest`.
5. Add browser tests, including axe in both modes.
