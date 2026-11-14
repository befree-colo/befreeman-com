import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBus } from '@befreeman/mfe-contract';
import type { RouteMatch } from '@befreeman/page-templates';
import { createRouter } from './router';
import type { Router } from './router';

let router: Router;
let routes: [RouteMatch, RouteMatch | null][];

function click(el: Element, init: MouseEventInit = {}) {
  const e = new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, button: 0, ...init });
  el.dispatchEvent(e);
  return e;
}

beforeEach(() => {
  history.replaceState({}, '', '/');
  document.body.innerHTML = '';
  routes = [];
  router = createRouter(getBus('test'), (r, p) => {
    routes.push([r, p]);
  });
});
afterEach(() => router.dispose());

describe('shell router', () => {
  it('starts from the current location', () => {
    expect(router.current.kind).toBe('home');
  });

  it('intercepts same-origin links and hands the sub-path to the owning remote', () => {
    document.body.innerHTML = '<a href="/achievements/cloud-migration">x</a>';
    const e = click(document.querySelector('a')!);
    expect(e.defaultPrevented).toBe(true);
    expect(location.pathname).toBe('/achievements/cloud-migration');
    expect(routes[0]![0]).toMatchObject({ kind: 'achievements', owner: 'achievements', subPath: 'cloud-migration' });
    expect(routes[0]![1]?.kind).toBe('home');
  });

  it('intercepts links inside a remote shadow root (composed path)', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<a href="/skills">skills</a>';
    const e = click(root.querySelector('a')!);
    expect(e.defaultPrevented).toBe(true);
    expect(router.current.kind).toBe('skills');
  });

  it.each([
    ['external links', '<a href="https://example.com/x">x</a>', {}],
    ['new-tab links', '<a href="/skills" target="_blank">x</a>', {}],
    ['modified clicks', '<a href="/skills">x</a>', { ctrlKey: true }],
    ['downloads', '<a href="/skills" download>x</a>', {}],
    ['files', '<a href="/sitemap.xml">x</a>', {}],
    ['in-page hash links', '<a href="/#skills">x</a>', {}],
  ])('leaves %s to the browser', (_label, markup, init) => {
    document.body.innerHTML = markup;
    let preventedByRouter: boolean | null = null;
    // Runs after the router's document listener; stops jsdom from attempting a real navigation.
    const stop = (ev: Event) => {
      preventedByRouter = ev.defaultPrevented;
      ev.preventDefault();
    };
    window.addEventListener('click', stop);
    click(document.querySelector('a')!, init);
    window.removeEventListener('click', stop);
    expect(preventedByRouter).toBe(false);
    expect(routes).toHaveLength(0);
  });

  it('navigates on nav:request (any participant may ask; only the shell acts)', () => {
    getBus('timeline').publish('nav:request', { path: '/timeline' });
    expect(location.pathname).toBe('/timeline');
    expect(router.current).toMatchObject({ kind: 'timeline', owner: 'timeline' });
    const before = history.length;
    getBus('x').publish('nav:request', { path: '/skills', replace: true });
    expect(history.length).toBe(before);
    expect(router.current.kind).toBe('skills');
  });

  it('a query-only change on the same path replaces state without re-routing', () => {
    router.navigate('/achievements');
    routes = [];
    getBus('achievements').publish('nav:request', { path: '/achievements?skill=aws', replace: true });
    expect(location.search).toBe('?skill=aws');
    expect(routes).toHaveLength(0);
  });

  it('re-routes on back/forward', () => {
    router.navigate('/skills');
    history.replaceState({}, '', '/timeline');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(routes.at(-1)![0].kind).toBe('timeline');
  });

  it('routes unknown paths to not-found', () => {
    router.navigate('/nope');
    expect(router.current).toMatchObject({ kind: 'not-found', owner: null });
  });

  it('stops listening after dispose', () => {
    router.dispose();
    const spy = vi.fn();
    void spy;
    getBus('x').publish('nav:request', { path: '/skills' });
    expect(location.pathname).toBe('/');
  });
});
