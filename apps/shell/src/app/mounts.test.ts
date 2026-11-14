import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBus } from '@befreeman/mfe-contract';
import type { DeploymentManifest, Mount, RemoteContext } from '@befreeman/mfe-contract';
import type { CareerContentBundle } from '@befreeman/content';
import { matchRoute } from '@befreeman/page-templates';
import type { RemoteLoader } from './federation';
import { MountManager } from './mounts';

const manifest: DeploymentManifest = {
  v: 1,
  content: { version: 'c', url: '/content/c.json' },
  ui: { version: 'u', entry: '/ui/u/ui.js' },
  remotes: {
    achievements: { version: '1.0.0-a', entry: '/remotes/achievements/a/remoteEntry.js', type: 'module', scope: 'bf_achievements', framework: 'angular' },
    timeline: { version: '2.0.0-t', entry: '/remotes/timeline/t/remoteEntry.js', type: 'module', scope: 'bf_timeline', framework: 'vue' },
    skills: { version: '3.0.0-s', entry: '/remotes/skills/s/remoteEntry.js', type: 'script', scope: 'bf_skills', framework: 'react' },
  },
};
const content = { version: 'c' } as unknown as CareerContentBundle;

function page(slots: string[]) {
  document.body.innerHTML = `<main>${slots
    .map((s) => `<div data-slot="${s}"><div data-prerendered><p>static ${s}</p></div></div>`)
    .join('')}</main>`;
  return document.querySelector('main')!;
}

const okMount = (label: string, unmount = vi.fn(async () => undefined)): Mount => async (el, ctx) => {
  el.innerHTML = `<p data-live>${label}:${ctx.route.subPath}:${ctx.meta.framework}@${ctx.meta.version}</p>`;
  return { unmount };
};

function loaderOf(impls: Record<string, () => Promise<{ mount: Mount }>>): RemoteLoader {
  return { load: (name) => (impls[name] ? impls[name]() : Promise.reject(new Error('no impl'))) };
}

let errors: unknown[];
let offErrors: () => void;
beforeEach(() => {
  errors = [];
  offErrors = getBus().subscribe('remote:error', (p) => errors.push(p));
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  offErrors();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function manager(loader: RemoteLoader, extra: Partial<ConstructorParameters<typeof MountManager>[0]> = {}) {
  return new MountManager({ manifest, loader, content, bus: getBus('shell'), theme: () => 'dark', timeoutMs: 200, ...extra });
}

describe('MountManager', () => {
  it('mounts a remote inside its own shadow root and hides the static fallback', async () => {
    const main = page(['achievements']);
    const m = manager(loaderOf({ achievements: async () => ({ mount: okMount('A') }) }));
    await Promise.all(m.mountRoute(matchRoute('/achievements/cloud'), main, { lazy: false }));
    const slot = main.querySelector<HTMLElement>('[data-slot]')!;
    const host = slot.querySelector<HTMLElement>('.bf-remote-host')!;
    expect(host.shadowRoot).not.toBeNull();
    expect(host.shadowRoot!.querySelector('[data-live]')?.textContent).toBe('A:cloud:angular@1.0.0-a');
    expect(slot.querySelector('[data-live]')).toBeNull(); // isolated: not in light DOM
    expect(slot.querySelector<HTMLElement>('[data-prerendered]')!.hidden).toBe(true);
    expect(slot.dataset['remoteState']).toBe('mounted');
    expect(m.statuses.get('achievements')).toMatchObject({ state: 'mounted', version: '1.0.0-a', framework: 'angular' });
  });

  it('keeps the static content and shows a notice when the entry fails to load', async () => {
    const main = page(['timeline']);
    const m = manager(loaderOf({ timeline: () => Promise.reject(new Error('404 remoteEntry.js')) }));
    await Promise.all(m.mountRoute(matchRoute('/timeline'), main, { lazy: false }));
    const slot = main.querySelector<HTMLElement>('[data-slot]')!;
    expect(slot.querySelector('.bf-remote-host')).toBeNull();
    expect(slot.querySelector<HTMLElement>('[data-prerendered]')!.hidden).toBe(false);
    expect(slot.querySelector('.bf-remote-notice')?.getAttribute('role')).toBe('status');
    expect(slot.dataset['remoteState']).toBe('failed');
    expect(errors).toEqual([{ name: 'timeline', version: '2.0.0-t', phase: 'load', message: '404 remoteEntry.js' }]);
  });

  it('restores the static content when a remote throws during mount', async () => {
    const main = page(['skills']);
    const throwing: Mount = async (el) => {
      el.innerHTML = '<p>half-rendered</p>';
      throw new Error('boom');
    };
    const m = manager(loaderOf({ skills: async () => ({ mount: throwing }) }));
    await Promise.all(m.mountRoute(matchRoute('/skills'), main, { lazy: false }));
    const slot = main.querySelector<HTMLElement>('[data-slot]')!;
    expect(slot.querySelector('.bf-remote-host')).toBeNull();
    expect(slot.textContent).toContain('static skills');
    expect(slot.textContent).not.toContain('half-rendered');
    expect(errors).toEqual([{ name: 'skills', version: '3.0.0-s', phase: 'mount', message: 'boom' }]);
  });

  it('falls back when a remote does not respond within the timeout', async () => {
    const main = page(['timeline']);
    const m = manager(loaderOf({ timeline: () => new Promise(() => undefined) }), { timeoutMs: 30 });
    await Promise.all(m.mountRoute(matchRoute('/timeline'), main, { lazy: false }));
    expect(m.statuses.get('timeline')?.state).toBe('failed');
    expect(m.statuses.get('timeline')?.error).toMatch(/timed out after 30ms/);
    expect(main.querySelector('.bf-remote-notice')).not.toBeNull();
  });

  it('one failing remote does not stop the others', async () => {
    const main = page(['achievements', 'timeline', 'skills']);
    const m = manager(
      loaderOf({
        achievements: async () => ({ mount: okMount('A') }),
        timeline: () => Promise.reject(new Error('down')),
        skills: async () => ({ mount: okMount('S') }),
      }),
    );
    await Promise.all(m.mountRoute(matchRoute('/'), main, { lazy: false }));
    expect([...m.statuses.values()].map((s) => [s.name, s.state])).toEqual([
      ['achievements', 'mounted'],
      ['timeline', 'failed'],
      ['skills', 'mounted'],
    ]);
  });

  it('mounts lazily when the slot approaches the viewport', async () => {
    let trigger: (entries: Partial<IntersectionObserverEntry>[]) => void = () => undefined;
    const observed: Element[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: (entries: Partial<IntersectionObserverEntry>[]) => void) {
          trigger = cb;
        }
        observe(el: Element) {
          observed.push(el);
        }
        unobserve() {
          // not needed by these tests
        }
        disconnect() {
          // not needed by these tests
        }
      },
    );
    const load = vi.fn(async () => ({ mount: okMount('S') }));
    const main = page(['skills']);
    const m = manager({ load });
    const pending = m.mountRoute(matchRoute('/'), main, { lazy: true });
    await new Promise((r) => setTimeout(r, 10));
    expect(load).not.toHaveBeenCalled();
    expect(m.statuses.get('skills')?.state).toBe('pending');
    trigger([{ isIntersecting: true, target: observed[0]! }]);
    await Promise.all(pending);
    expect(load).toHaveBeenCalledOnce();
    expect(m.statuses.get('skills')?.state).toBe('mounted');
  });

  it('unmountAll unmounts remotes and removes their hosts', async () => {
    const unmount = vi.fn(async () => undefined);
    const main = page(['skills']);
    const m = manager(loaderOf({ skills: async () => ({ mount: okMount('S', unmount) }) }));
    await Promise.all(m.mountRoute(matchRoute('/skills'), main, { lazy: false }));
    await m.unmountAll();
    expect(unmount).toHaveBeenCalledOnce();
    expect(main.querySelector('.bf-remote-host')).toBeNull();
  });

  it('a remote that finishes mounting after navigation away is unmounted immediately', async () => {
    let resolveLoad: (v: { mount: Mount }) => void = () => undefined;
    const unmount = vi.fn(async () => undefined);
    const main = page(['skills']);
    const m = manager({ load: () => new Promise((r) => (resolveLoad = r)) });
    const pending = m.mountRoute(matchRoute('/skills'), main, { lazy: false });
    await m.unmountAll();
    resolveLoad({ mount: okMount('S', unmount) });
    await Promise.all(pending);
    expect(main.querySelector('.bf-remote-host')).toBeNull();
  });

  it('does not mount remotes when the shared ui components are unavailable', async () => {
    const load = vi.fn();
    const main = page(['skills']);
    const m = manager({ load }, { canMount: () => false });
    await Promise.all(m.mountRoute(matchRoute('/skills'), main, { lazy: false }));
    expect(load).not.toHaveBeenCalled();
    expect(m.statuses.get('skills')?.state).toBe('failed');
    expect(main.querySelector<HTMLElement>('[data-prerendered]')!.hidden).toBe(false);
  });

  it('passes the full context to the remote', async () => {
    let seen: RemoteContext | null = null;
    const main = page(['timeline']);
    const m = manager(
      loaderOf({
        timeline: async () => ({
          mount: async (_el, ctx) => {
            seen = ctx;
            return { unmount: async () => undefined };
          },
        }),
      }),
    );
    await Promise.all(m.mountRoute(matchRoute('/timeline'), main, { lazy: false }));
    expect(seen).toMatchObject({ route: { path: '/timeline', subPath: '' }, content, theme: 'dark', meta: { name: 'timeline', framework: 'vue', version: '2.0.0-t' } });
  });
});
