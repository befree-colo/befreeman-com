import { animations, durations, easings } from './tokens';
import type { AnimationName, DurationName, EasingName } from './tokens';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** True when the visitor's system asks for reduced motion (false outside the browser). */
export function prefersReducedMotion(win: Pick<Window, 'matchMedia'> | undefined = globalThis.window): boolean {
  return !!win?.matchMedia?.(REDUCED_MOTION_QUERY).matches;
}

/** Call `listener` whenever the reduced-motion preference changes. Returns an unsubscribe function. */
export function onReducedMotionChange(
  listener: (reduced: boolean) => void,
  win: Pick<Window, 'matchMedia'> | undefined = globalThis.window,
): () => void {
  const mql = win?.matchMedia?.(REDUCED_MOTION_QUERY);
  if (!mql) return () => undefined;
  const handler = (e: MediaQueryListEvent) => listener(e.matches);
  mql.addEventListener('change', handler);
  return () => mql.removeEventListener('change', handler);
}

export interface ResolvedMotion {
  reduced: boolean;
  /** Milliseconds; all 0 when reduced. */
  durations: Record<DurationName, number>;
  easings: Record<EasingName, string>;
  /** CSS `animation` values; all `none` when reduced. */
  animations: Record<AnimationName, string>;
}

/**
 * Resolve motion tokens for the current (or given) preference. Every JS-driven
 * animation (canvas, Web Animations API, scroll choreography) must read from here
 * so reduced motion is honored everywhere.
 */
export function resolveMotion(options: { reduced?: boolean } = {}): ResolvedMotion {
  const reduced = options.reduced ?? prefersReducedMotion();
  const mapValues = <K extends string, V, R>(obj: Record<K, V>, fn: (v: V) => R) =>
    Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v as V)])) as Record<K, R>;
  return {
    reduced,
    durations: mapValues(durations, (ms) => (reduced ? 0 : ms)),
    easings: { ...easings },
    animations: mapValues(animations, (a) => (reduced ? 'none' : a.value)),
  };
}

/** Duration in ms for a named token, honoring reduced motion. */
export function motionDuration(name: DurationName, options: { reduced?: boolean } = {}): number {
  return resolveMotion(options).durations[name];
}

/**
 * Web Animations API helper that becomes an instant jump to the final frame under
 * reduced motion, so content is never left mid-animation or hidden.
 */
export function animate(
  el: Element,
  keyframes: Keyframe[],
  options: { duration?: DurationName; easing?: EasingName; reduced?: boolean; fill?: FillMode } = {},
): Animation | null {
  const motion = resolveMotion(options.reduced === undefined ? {} : { reduced: options.reduced });
  const duration = motion.durations[options.duration ?? 'base'];
  if (motion.reduced || duration === 0 || typeof el.animate !== 'function') {
    const last = keyframes[keyframes.length - 1];
    if (last && el instanceof HTMLElement) {
      for (const [prop, value] of Object.entries(last)) {
        if (prop !== 'offset' && prop !== 'easing' && prop !== 'composite' && value != null) {
          el.style.setProperty(prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), String(value));
        }
      }
    }
    return null;
  }
  return el.animate(keyframes, { duration, easing: motion.easings[options.easing ?? 'standard'], fill: options.fill ?? 'both' });
}
