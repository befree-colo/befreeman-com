import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type BusModule = typeof import('./bus');

async function freshCopy(): Promise<BusModule> {
  // Each call yields a separate module instance, like two remotes that each bundle the library.
  vi.resetModules();
  return import('./bus');
}

describe('page event bus', () => {
  beforeEach(() => {
    delete (globalThis as Record<string, unknown>)['__befreemanBus__'];
  });
  afterEach(() => vi.restoreAllMocks());

  it('delivers events between two separately bundled copies', async () => {
    const remoteA = await freshCopy();
    const remoteB = await freshCopy();
    expect(remoteA.getBus).not.toBe(remoteB.getBus);

    const received: unknown[] = [];
    remoteB.getBus().subscribe('entity:focus', (payload) => received.push(payload));
    const delivered = remoteA.getBus('timeline').publish('entity:focus', { type: 'role', id: 'acme' });

    expect(delivered).toBe(true);
    expect(received).toEqual([{ type: 'role', id: 'acme' }]);
  });

  it('passes the envelope with contract version and source', async () => {
    const { getBus, CONTRACT_VERSION } = { ...(await freshCopy()), ...(await import('./events')) };
    const handler = vi.fn();
    getBus().subscribe('nav:request', handler);
    getBus('skills').publish('nav:request', { path: '/achievements/x' });
    expect(handler).toHaveBeenCalledWith(
      { path: '/achievements/x' },
      { v: CONTRACT_VERSION, name: 'nav:request', payload: { path: '/achievements/x' }, source: 'skills' },
    );
  });

  it('rejects malformed payloads and logs a diagnostic', async () => {
    const { getBus } = await freshCopy();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const handler = vi.fn();
    getBus().subscribe('entity:focus', handler);

    // @ts-expect-error deliberately invalid payload
    const delivered = getBus().publish('entity:focus', { type: 'planet', id: '' });

    expect(delivered).toBe(false);
    expect(handler).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('stays silent about malformed payloads when diagnostics are off (production)', async () => {
    const { getBus, configureBus } = await freshCopy();
    configureBus({ diagnostics: false });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // Type-valid string, but the schema requires a leading slash.
    expect(getBus().publish('nav:request', { path: 'no-leading-slash' })).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it('rejects unknown event names at runtime', async () => {
    const { getBus } = await freshCopy();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // @ts-expect-error deliberately unknown event
    expect(getBus().publish('nav:teleport', { path: '/' })).toBe(false);
  });

  it('does not deliver after a subscription is disposed', async () => {
    const { getBus } = await freshCopy();
    const handler = vi.fn();
    const dispose = getBus().subscribe('theme:changed', handler);
    getBus().publish('theme:changed', { theme: 'dark' });
    dispose();
    dispose(); // idempotent
    getBus().publish('theme:changed', { theme: 'light' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('disposes every subscription in a scope at once', async () => {
    const { getBus, createScopedBus } = await freshCopy();
    const scoped = createScopedBus(getBus());
    const a = vi.fn();
    const b = vi.fn();
    scoped.subscribe('entity:focus', a);
    scoped.subscribe('route:changed', b);
    expect(scoped.size).toBe(2);
    scoped.disposeAll();
    expect(scoped.size).toBe(0);
    getBus().publish('entity:focus', { type: 'skill', id: 'ts' });
    getBus().publish('route:changed', { path: '/', subPath: '', owner: null });
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it('isolates a throwing subscriber from other subscribers', async () => {
    const { getBus } = await freshCopy();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const ok = vi.fn();
    getBus().subscribe('entity:focus', () => {
      throw new Error('boom');
    });
    getBus().subscribe('entity:focus', ok);
    getBus().publish('entity:focus', { type: 'role', id: 'x' });
    expect(ok).toHaveBeenCalledOnce();
  });

  it('ignores envelopes from an incompatible contract version', async () => {
    const { getBus } = await freshCopy();
    const handler = vi.fn();
    getBus().subscribe('entity:focus', handler);
    const target = (globalThis as unknown as { __befreemanBus__: { target: EventTarget } }).__befreemanBus__.target;
    target.dispatchEvent(
      new CustomEvent('bf:entity:focus', { detail: { v: 99, name: 'entity:focus', payload: { type: 'role', id: 'x' } } }),
    );
    expect(handler).not.toHaveBeenCalled();
  });
});
