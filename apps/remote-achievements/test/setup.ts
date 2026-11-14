import '@angular/compiler'; // JIT compilation for tests
import { vi } from 'vitest';

// jsdom lacks constructable stylesheets; the real browser path is covered by e2e.
if (!('replaceSync' in CSSStyleSheet.prototype)) {
  Object.defineProperty(CSSStyleSheet.prototype, 'replaceSync', { value: () => undefined });
}
if (!('adoptedStyleSheets' in ShadowRoot.prototype)) {
  Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', { value: [], writable: true });
}
Element.prototype.scrollIntoView = vi.fn();
window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
