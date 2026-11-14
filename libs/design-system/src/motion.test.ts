import { describe, expect, it, vi } from 'vitest';
import { motionDuration, onReducedMotionChange, prefersReducedMotion, resolveMotion } from './motion';
import { animations, durations } from './tokens';

const fakeWindow = (matches: boolean) => {
  const listeners: ((e: { matches: boolean }) => void)[] = [];
  return {
    matchMedia: vi.fn(() => ({
      matches,
      addEventListener: (_: string, l: (e: { matches: boolean }) => void) => listeners.push(l),
      removeEventListener: (_: string, l: (e: { matches: boolean }) => void) => listeners.splice(listeners.indexOf(l), 1),
    })),
    fire: (m: boolean) => listeners.forEach((l) => l({ matches: m })),
    listeners,
  };
};

describe('motion primitives', () => {
  it('reduced motion resolves every duration to 0', () => {
    const motion = resolveMotion({ reduced: true });
    expect(motion.reduced).toBe(true);
    expect(Object.values(motion.durations).every((ms) => ms === 0)).toBe(true);
    expect(Object.keys(motion.durations).sort()).toEqual(Object.keys(durations).sort());
  });

  it('reduced motion disables every named animation', () => {
    const motion = resolveMotion({ reduced: true });
    expect(Object.values(motion.animations).every((a) => a === 'none')).toBe(true);
    expect(Object.keys(motion.animations).sort()).toEqual(Object.keys(animations).sort());
  });

  it('full motion keeps token values', () => {
    const motion = resolveMotion({ reduced: false });
    expect(motion.durations.slow).toBe(durations.slow);
    expect(motion.animations.rise).toBe(animations.rise.value);
    expect(motionDuration('dramatic', { reduced: false })).toBe(800);
    expect(motionDuration('dramatic', { reduced: true })).toBe(0);
  });

  it('reads the system preference via matchMedia', () => {
    expect(prefersReducedMotion(fakeWindow(true) as unknown as Window)).toBe(true);
    expect(prefersReducedMotion(fakeWindow(false) as unknown as Window)).toBe(false);
    expect(prefersReducedMotion(undefined)).toBe(false);
  });

  it('notifies on preference changes and unsubscribes', () => {
    const win = fakeWindow(false);
    const listener = vi.fn();
    const off = onReducedMotionChange(listener, win as unknown as Window);
    win.fire(true);
    off();
    win.fire(false);
    expect(listener).toHaveBeenCalledExactlyOnceWith(true);
  });
});
