import { describe, expect, it, vi } from 'vitest';
import { animate } from './motion';

describe('animate()', () => {
  it('jumps straight to the final frame under reduced motion', () => {
    const el = document.createElement('div');
    el.animate = vi.fn();
    const result = animate(el, [{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'none' }], {
      reduced: true,
    });
    expect(result).toBeNull();
    expect(el.animate).not.toHaveBeenCalled();
    expect(el.style.opacity).toBe('1');
    expect(el.style.transform).toBe('none');
  });

  it('uses the Web Animations API with token durations otherwise', () => {
    const el = document.createElement('div');
    const fake = {} as Animation;
    el.animate = vi.fn(() => fake);
    expect(animate(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 'slow', easing: 'emphasized', reduced: false })).toBe(fake);
    expect(el.animate).toHaveBeenCalledWith([{ opacity: 0 }, { opacity: 1 }], {
      duration: 450,
      easing: 'cubic-bezier(0.3, 0, 0, 1.3)',
      fill: 'both',
    });
  });
});
