/**
 * The single source of design tokens. CSS is generated from this file
 * (`nx run design-system:generate`); JS consumers (canvas radar, OG images)
 * import the values directly.
 */

export type Mode = 'light' | 'dark';

/** Semantic color roles. Utilities are named after these, e.g. `bg-surface`, `text-ink`, `bg-accent`. */
export const colorRoles = [
  'surface',
  'surface-raised',
  'surface-sunken',
  'ink',
  'ink-muted',
  'accent',
  'accent-ink',
  'accent-2',
  'border',
  'focus',
  'success',
  'danger',
] as const;
export type ColorRole = (typeof colorRoles)[number];

export const colors: Record<Mode, Record<ColorRole, string>> = {
  dark: {
    surface: '#0b0d17',
    'surface-raised': '#151a2e',
    'surface-sunken': '#070910',
    ink: '#f3f4ff',
    'ink-muted': '#a9b0d6',
    accent: '#8b7cff',
    'accent-ink': '#0b0d17',
    'accent-2': '#22d3ee',
    border: '#2a3152',
    focus: '#facc15',
    success: '#34d399',
    danger: '#f87171',
  },
  light: {
    surface: '#f7f7fb',
    'surface-raised': '#ffffff',
    'surface-sunken': '#ecedf5',
    ink: '#0f1222',
    'ink-muted': '#4a5070',
    accent: '#5b3df5',
    'accent-ink': '#ffffff',
    'accent-2': '#0e7490',
    border: '#d5d8e8',
    focus: '#b45309',
    success: '#047857',
    danger: '#b91c1c',
  },
};

/** Foreground/background pairs that must meet WCAG 2.2 AA in both modes. */
export const contrastPairs: { fg: ColorRole; bg: ColorRole; min: number; why: string }[] = [
  { fg: 'ink', bg: 'surface', min: 4.5, why: 'body text' },
  { fg: 'ink', bg: 'surface-raised', min: 4.5, why: 'text on cards' },
  { fg: 'ink', bg: 'surface-sunken', min: 4.5, why: 'text on wells' },
  { fg: 'ink-muted', bg: 'surface', min: 4.5, why: 'secondary text' },
  { fg: 'ink-muted', bg: 'surface-raised', min: 4.5, why: 'secondary text on cards' },
  { fg: 'accent-ink', bg: 'accent', min: 4.5, why: 'primary button label' },
  { fg: 'accent', bg: 'surface', min: 4.5, why: 'links and accent text' },
  { fg: 'accent', bg: 'surface-raised', min: 4.5, why: 'links on cards' },
  { fg: 'accent-2', bg: 'surface', min: 3, why: 'secondary accent graphics' },
  { fg: 'focus', bg: 'surface', min: 3, why: 'focus indicator (non-text)' },
  { fg: 'focus', bg: 'surface-raised', min: 3, why: 'focus indicator on cards' },
  { fg: 'success', bg: 'surface', min: 4.5, why: 'success text' },
  { fg: 'danger', bg: 'surface', min: 4.5, why: 'error text' },
];

export const fonts = {
  display: "'Space Grotesk Variable', 'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
  sans: "'Inter Variable', 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

/** Type scale: [font-size, line-height]. Fluid sizes for the bold display steps. */
export const typeScale = {
  xs: ['0.75rem', '1rem'],
  sm: ['0.875rem', '1.25rem'],
  base: ['1rem', '1.6rem'],
  lg: ['1.125rem', '1.75rem'],
  xl: ['1.375rem', '1.9rem'],
  '2xl': ['clamp(1.6rem, 1.2rem + 1.5vw, 2rem)', '1.2'],
  '3xl': ['clamp(2rem, 1.4rem + 2.5vw, 3rem)', '1.1'],
  '4xl': ['clamp(2.5rem, 1.5rem + 4.5vw, 4.5rem)', '1.02'],
  '5xl': ['clamp(3rem, 1.5rem + 7vw, 7rem)', '0.95'],
} as const;

/** Base spacing unit; Tailwind multiplies it (p-4 = 4 × spacing). */
export const spacing = '0.25rem';

export const radius = {
  sm: '0.375rem',
  md: '0.75rem',
  lg: '1.25rem',
  xl: '2rem',
  pill: '999px',
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.25)',
  md: '0 6px 20px -6px rgb(0 0 0 / 0.35)',
  lg: '0 18px 50px -12px rgb(0 0 0 / 0.45)',
  glow: '0 0 0 1px color-mix(in oklab, var(--bf-accent) 40%, transparent), 0 10px 40px -10px color-mix(in oklab, var(--bf-accent) 60%, transparent)',
} as const;

/** Motion durations in milliseconds. Reduced motion resolves every duration to 0. */
export const durations = {
  instant: 0,
  fast: 150,
  base: 250,
  slow: 450,
  dramatic: 800,
} as const;
export type DurationName = keyof typeof durations;

export const easings = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  emphasized: 'cubic-bezier(0.3, 0, 0, 1.3)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
} as const;
export type EasingName = keyof typeof easings;

/** Named animations: CSS `animation` shorthands and their keyframes. */
export const animations = {
  rise: {
    value: `bf-rise ${durations.slow}ms ${easings.emphasized} both`,
    keyframes: 'from { opacity: 0; transform: translateY(1.25rem); } to { opacity: 1; transform: none; }',
  },
  fade: {
    value: `bf-fade ${durations.base}ms ${easings.standard} both`,
    keyframes: 'from { opacity: 0; } to { opacity: 1; }',
  },
  pulse: {
    value: `bf-pulse 1600ms ${easings.standard} infinite`,
    keyframes: '0%, 100% { opacity: 1; } 50% { opacity: 0.55; }',
  },
} as const;
export type AnimationName = keyof typeof animations;

/** Breakpoints (min-width). */
export const breakpoints = { sm: '40rem', md: '48rem', lg: '64rem', xl: '80rem' } as const;
