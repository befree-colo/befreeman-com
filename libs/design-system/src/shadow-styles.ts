/**
 * Turn compiled CSS text into a constructable stylesheet and adopt it into a
 * shadow root. Sheets are cached by their text, so remounting a remote (or many
 * instances of a component) parses the CSS once.
 */
const cache = new Map<string, CSSStyleSheet>();

export function createShadowStyles(cssText: string): CSSStyleSheet {
  let sheet = cache.get(cssText);
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(cssText);
    cache.set(cssText, sheet);
  }
  return sheet;
}

/** Append sheets to a shadow root's adopted stylesheets without duplicating any. */
export function adoptStyles(root: ShadowRoot, ...sheets: CSSStyleSheet[]): void {
  const current = root.adoptedStyleSheets;
  root.adoptedStyleSheets = [...current, ...sheets.filter((s) => !current.includes(s))];
}

/** Create (or reuse) an open shadow root on `host` and adopt the given CSS into it. */
export function attachStyledShadow(host: HTMLElement, ...cssTexts: string[]): ShadowRoot {
  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  adoptStyles(root, ...cssTexts.map(createShadowStyles));
  return root;
}

/** Test hook: number of cached sheets. */
export function shadowStyleCacheSize(): number {
  return cache.size;
}
