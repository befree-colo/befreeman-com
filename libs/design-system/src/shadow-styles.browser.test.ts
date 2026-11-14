import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import fixtureCss from '../test/browser/fixture.css?inline';
import documentCss from '../css/document.css?inline';
import { colors } from './tokens';
import { adoptStyles, attachStyledShadow, createShadowStyles, shadowStyleCacheSize } from './shadow-styles';

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

let documentStyle: HTMLStyleElement;
beforeAll(() => {
  // What the shell does once per page.
  documentStyle = document.createElement('style');
  documentStyle.textContent = documentCss;
  document.head.append(documentStyle);
});

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.removeAttribute('data-theme');
});

function mountInShadow(classes: string, css = fixtureCss): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  const root = attachStyledShadow(host, css);
  const el = document.createElement('div');
  el.className = classes;
  el.textContent = 'fixture';
  root.append(el);
  return el;
}

describe('createShadowStyles', () => {
  it('caches one sheet per CSS text', () => {
    const before = shadowStyleCacheSize();
    const a = createShadowStyles('.x{color:red}');
    const b = createShadowStyles('.x{color:red}');
    expect(a).toBe(b);
    expect(shadowStyleCacheSize()).toBe(before + 1);
  });

  it('adoptStyles does not duplicate sheets', () => {
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'open' });
    const sheet = createShadowStyles('.y{color:blue}');
    adoptStyles(root, sheet);
    adoptStyles(root, sheet);
    expect(root.adoptedStyleSheets).toHaveLength(1);
  });
});

describe('Tailwind utilities inside a shadow root', () => {
  it('applies semantic color, spacing, radius, and font utilities', () => {
    const el = mountInShadow('bg-accent text-ink p-4 rounded-lg font-display');
    const style = getComputedStyle(el);
    expect(style.backgroundColor).toBe(rgb(colors.light.accent));
    expect(style.paddingTop).toBe('16px');
    expect(style.borderTopLeftRadius).toBe('20px');
    expect(style.fontFamily).toContain('Space Grotesk');
  });

  it('applies shadow, ring, rotate, 3D transform, and gradient utilities (needs document-level @property)', () => {
    const shadow = getComputedStyle(mountInShadow('shadow-lg'));
    expect(shadow.boxShadow).not.toBe('none');
    expect(shadow.boxShadow).toContain('rgba(0, 0, 0, 0.45)');

    const ring = getComputedStyle(mountInShadow('ring-2 ring-accent-2'));
    expect(ring.boxShadow).toContain(rgb(colors.light['accent-2']));

    expect(getComputedStyle(mountInShadow('rotate-3')).rotate).toBe('3deg');
    expect(getComputedStyle(mountInShadow('rotate-x-12')).transform).not.toBe('none');

    const gradient = getComputedStyle(mountInShadow('bg-linear-to-r from-accent to-accent-2'));
    expect(gradient.backgroundImage).toContain('linear-gradient');
    expect(gradient.backgroundImage).toContain(rgb(colors.light.accent));
  });

  it('re-themes shadow content when data-theme flips on <html>, without a reload', () => {
    const el = mountInShadow('bg-accent');
    expect(getComputedStyle(el).backgroundColor).toBe(rgb(colors.light.accent));
    document.documentElement.dataset['theme'] = 'dark';
    expect(getComputedStyle(el).backgroundColor).toBe(rgb(colors.dark.accent));
    document.documentElement.dataset['theme'] = 'light';
    expect(getComputedStyle(el).backgroundColor).toBe(rgb(colors.light.accent));
  });

  it('control: without document-level @property registrations, shadows break inside the shadow root', () => {
    documentStyle.remove();
    try {
      // Stylesheet-defined @property rules unregister when their sheet is removed.
      expect(getComputedStyle(mountInShadow('shadow-lg')).boxShadow).toBe('none');
    } finally {
      document.head.append(documentStyle);
    }
    expect(getComputedStyle(mountInShadow('shadow-lg')).boxShadow).not.toBe('none');
  });
});
