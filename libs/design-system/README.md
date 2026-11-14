# @befreeman/design-system

One theme for the whole site. Tokens live in TypeScript (`src/tokens.ts`). CSS is generated from them, and JS consumers (canvas visuals, social preview images) import the same values.

```bash
pnpm nx run design-system:generate   # regenerate css/*.css after editing src/tokens.ts
pnpm nx test design-system           # CSS snapshots, AA contrast, motion, shadow-DOM computed styles (Chromium)
```

## Generated files

| File | Loaded by | Contents |
|---|---|---|
| `css/theme.css` | every Tailwind build (through `tailwind.css`) | Tailwind v4 `@theme`: utilities map to **semantic variables** (`bg-surface`, `text-ink`, `bg-accent`, `ring-focus`, ...); the default palette is removed |
| `css/base.css` | every Tailwind build (through `tailwind.css`) | element defaults for `:host` and `html`, focus ring, reduced-motion overrides |
| `css/modes.css` | page level only (through `document.css`) | `--bf-*` color values for `:root[data-theme='light'\|'dark']`, a system-preference fallback, duration variables |
| `css/document.css` | **the shell, once, at page level** | self-hosted fonts, `modes.css`, and the `@property` registrations Tailwind utilities need |

## Using Tailwind in a project

Each project (shell, remote, `ui-components`) has its own stylesheet:

```css
@import '@befreeman/design-system/tailwind.css';
@source '../src';
```

`tailwind.css` imports Tailwind with automatic source detection **off**, plus the theme and base layers. Each project lists what it scans with `@source` and ships only the utilities it uses.

Build plugins: `@tailwindcss/postcss` for the Rspack builds (shell, React, Angular) and `@tailwindcss/vite` for Vite builds (Vue, `ui-components`).

## Shadow DOM

Remotes and components render inside shadow roots for isolation. Three rules make the theme work there:

1. **Adopt the compiled sheet** into the shadow root:

   ```ts
   import css from './styles.css?inline';
   import { attachStyledShadow } from '@befreeman/design-system';

   const root = attachStyledShadow(hostElement, css); // cached CSSStyleSheet, adopted once
   ```

   `createShadowStyles(cssText)` and `adoptStyles(root, ...sheets)` are the lower-level pieces.

2. **The shell loads `document.css` at page level.** Browsers ignore `@property` inside shadow roots, and without those registrations Tailwind shadows, rings, transforms, and gradients silently break. A browser test proves both the failure and the fix.

3. **No `dark:` variant.** Selector variants can't cross the shadow boundary, but CSS custom properties inherit into it. Write `bg-surface text-ink`; when the shell flips `data-theme` on `<html>`, every shadow root re-themes instantly.

## Modes

The shell owns the mode:
1. An inline script sets `data-theme` before first paint, from the stored choice or the system preference.
2. `<bf-theme-toggle>` reports changes.
3. The shell persists the choice and publishes `theme:changed`.

CSS follows automatically. Only JS-drawn visuals (canvas) need to listen for the event and redraw using `colors[mode]` from this package.

## Motion

Use token-backed motion so reduced motion is honored everywhere:

- **CSS**: `duration-token-fast|base|slow`, `ease-standard|emphasized|exit`, and `animate-rise|fade|pulse`. Gate decorative motion with Tailwind's `motion-safe:` and provide `motion-reduce:` alternatives where needed. `base.css` also disables animations and transitions under `prefers-reduced-motion: reduce`.
- **JS**: `resolveMotion()` returns durations (all `0` when reduced) and animation values (all `none` when reduced). `animate(el, keyframes, { duration: 'slow' })` jumps straight to the final frame when motion is reduced. `onReducedMotionChange(cb)` reports changes.

## Contrast

`contrastPairs` in `tokens.ts` lists every foreground/background pairing the UI uses. The test suite checks each one against WCAG 2.2 AA in both modes, so a token change that breaks contrast fails CI.
