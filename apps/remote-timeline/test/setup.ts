import { vi } from 'vitest';

if (!('replaceSync' in CSSStyleSheet.prototype)) {
  Object.defineProperty(CSSStyleSheet.prototype, 'replaceSync', { value: () => undefined });
}
if (!('adoptedStyleSheets' in ShadowRoot.prototype)) {
  Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', { value: [], writable: true });
}
Element.prototype.scrollIntoView = vi.fn();

let reduced = false;
export function setReducedMotion(value: boolean): void {
  reduced = value;
}
window.matchMedia = ((q: string) => ({
  matches: q.includes('reduce') ? reduced : false,
  media: q,
  addEventListener() {},
  removeEventListener() {},
})) as unknown as typeof window.matchMedia;
