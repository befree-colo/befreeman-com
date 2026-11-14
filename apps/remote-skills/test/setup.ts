import { vi } from 'vitest';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

if (!('replaceSync' in CSSStyleSheet.prototype)) {
  Object.defineProperty(CSSStyleSheet.prototype, 'replaceSync', { value: () => undefined });
}
if (!('adoptedStyleSheets' in ShadowRoot.prototype)) {
  Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', { value: [], writable: true });
}
Element.prototype.scrollIntoView = vi.fn();

let reduced = true; // instant draws by default; tests opt into motion explicitly
export function setReducedMotion(v: boolean): void {
  reduced = v;
}
window.matchMedia = ((q: string) => ({
  matches: q.includes('reduce') ? reduced : false,
  media: q,
  addEventListener() {},
  removeEventListener() {},
})) as unknown as typeof window.matchMedia;

/** A recording 2D context: every fillStyle assignment is kept for assertions. */
export const fills: string[] = [];
const ctx = new Proxy(
  {},
  {
    get: (_t, prop) => (prop === 'canvas' ? undefined : () => undefined),
    set: (_t, prop, value) => {
      if (prop === 'fillStyle') fills.push(String(value));
      return true;
    },
  },
);
HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as unknown as HTMLCanvasElement['getContext'];
