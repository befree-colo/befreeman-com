// Mirrors README snippets so `nx typecheck design-system` proves they compile.
import css from './browser/fixture.css?inline';
import { attachStyledShadow, animate, onReducedMotionChange, resolveMotion } from '../src';

const hostElement = document.createElement('div');
export const root: ShadowRoot = attachStyledShadow(hostElement, css); // cached CSSStyleSheet, adopted once

export const zero: number = resolveMotion({ reduced: true }).durations.slow;
export const anim = animate(hostElement, [{ opacity: 0 }, { opacity: 1 }], { duration: 'slow' });
export const off: () => void = onReducedMotionChange((reduced) => console.log(reduced));
