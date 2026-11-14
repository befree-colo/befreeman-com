import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import { generateAll } from './generate-all';
import { colorRoles, colors, contrastPairs } from './tokens';
import type { Mode } from './tokens';

const css = (name: string) => readFile(fileURLToPath(new URL(`../css/${name}`, import.meta.url)), 'utf8');

describe('generated CSS', () => {
  it('committed css/ files match the token source (run `nx run design-system:generate` if this fails)', async () => {
    const generated = await generateAll();
    for (const [name, content] of Object.entries(generated)) {
      expect(await css(name), name).toBe(content);
    }
  });

  it('theme.css maps every color utility to a semantic variable and drops the default palette', async () => {
    const theme = await css('theme.css');
    expect(theme).toContain('@theme inline {');
    expect(theme).toContain('--color-*: initial;');
    for (const role of colorRoles) expect(theme).toContain(`--color-${role}: var(--bf-${role});`);
    expect(theme).not.toMatch(/--color-(red|blue|slate)-\d+/);
    expect(theme).toMatchSnapshot();
  });

  it('modes.css defines light and dark values keyed off data-theme, with a system fallback', async () => {
    const modes = await css('modes.css');
    expect(modes).toContain(":root[data-theme='dark']");
    expect(modes).toContain(':root:not([data-theme])');
    expect(modes).toContain(`--bf-surface: ${colors.dark.surface};`);
    expect(modes).toContain(`--bf-surface: ${colors.light.surface};`);
    expect(modes).toMatchSnapshot();
  });

  it('document.css registers the @property rules shadows, rings, transforms, and gradients depend on', async () => {
    const doc = await css('document.css');
    for (const prop of ['--tw-shadow', '--tw-ring-shadow', '--tw-rotate-x', '--tw-gradient-from', '--tw-blur']) {
      expect(doc, prop).toMatch(new RegExp(`@property ${prop} \\{`));
    }
    expect(doc).toContain("@import './modes.css';");
    expect(doc).toContain('@fontsource-variable/inter');
  });

  it('base.css is shadow-root aware and disables motion under prefers-reduced-motion', async () => {
    const base = await css('base.css');
    expect(base).toContain(':host,');
    expect(base).toMatch(/prefers-reduced-motion: reduce[\s\S]*animation: none !important/);
    expect(base).toMatchSnapshot();
  });
});

describe('color contrast (WCAG 2.2 AA)', () => {
  const modes: Mode[] = ['light', 'dark'];
  for (const mode of modes) {
    for (const pair of contrastPairs) {
      it(`${mode}: ${pair.fg} on ${pair.bg} ≥ ${pair.min} (${pair.why})`, () => {
        const ratio = contrastRatio(colors[mode][pair.fg], colors[mode][pair.bg]);
        expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(pair.min);
      });
    }
  }

  it('computes known reference ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});
