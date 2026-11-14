// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { defineRemote, getBus } from './index';
import type { RemoteContext } from './index';

function ctx(): RemoteContext<{ title: string }> {
  return {
    route: { path: '/x', subPath: '', query: new URLSearchParams() },
    content: { title: 'hello' },
    bus: getBus('shell'),
    theme: 'dark',
    meta: { name: 'demo', version: '1.0.0', framework: 'vanilla' },
  };
}

describe('defineRemote', () => {
  it('removes bus subscriptions and DOM on unmount', async () => {
    const handler = vi.fn();
    const mount = defineRemote<{ title: string }>(async (el, c) => {
      el.innerHTML = `<p>${c.content.title}</p>`;
      c.bus.subscribe('entity:focus', handler);
      return {
        async unmount() {
          // nothing extra to clean up
        },
      };
    });
    const el = document.createElement('div');
    const instance = await mount(el, ctx());
    expect(el.textContent).toBe('hello');

    await instance.unmount();
    getBus().publish('entity:focus', { type: 'role', id: 'r' });

    expect(handler).not.toHaveBeenCalled();
    expect(el.childNodes).toHaveLength(0);
  });

  it('cleans up when the implementation throws during mount', async () => {
    const handler = vi.fn();
    const mount = defineRemote(async (el, c) => {
      el.append(document.createElement('span'));
      c.bus.subscribe('entity:focus', handler);
      throw new Error('mount failed');
    });
    const el = document.createElement('div');
    await expect(mount(el, ctx())).rejects.toThrow('mount failed');
    getBus().publish('entity:focus', { type: 'role', id: 'r' });
    expect(handler).not.toHaveBeenCalled();
    expect(el.childNodes).toHaveLength(0);
  });

  it('makes unmount idempotent', async () => {
    const inner = vi.fn(async () => undefined);
    const mount = defineRemote(async () => ({ unmount: inner }));
    const instance = await mount(document.createElement('div'), ctx());
    await instance.unmount();
    await instance.unmount();
    expect(inner).toHaveBeenCalledOnce();
  });
});
