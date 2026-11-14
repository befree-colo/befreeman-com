import { matchRoute } from '@befreeman/page-templates';
import type { RouteMatch } from '@befreeman/page-templates';
import type { EventBus } from '@befreeman/mfe-contract';

export interface Router {
  readonly current: RouteMatch;
  navigate(path: string, opts?: { replace?: boolean }): void;
  dispose(): void;
}

/**
 * Shell-owned top-level routing: history API, same-origin link interception
 * (including links inside remotes' shadow roots), and `nav:request` handling.
 * Remotes never touch history themselves.
 */
export function createRouter(
  bus: EventBus,
  onRoute: (route: RouteMatch, prev: RouteMatch | null) => void | Promise<void>,
  win: Window = window,
): Router {
  let current = matchRoute(win.location.pathname);

  const go = (path: string, replace: boolean) => {
    const url = new URL(path, win.location.href);
    if (url.origin !== win.location.origin) {
      win.location.assign(url.href);
      return;
    }
    const prev = current;
    const next = matchRoute(url.pathname);
    const samePage = next.path === prev.path;
    if (replace || samePage) win.history.replaceState({}, '', url.pathname + url.search + url.hash);
    else win.history.pushState({}, '', url.pathname + url.search + url.hash);
    if (samePage) {
      // Same page: query/hash changes (e.g. a remote reflecting filters in the URL) never re-route.
      if (url.hash) win.document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView();
      return;
    }
    current = next;
    void onRoute(next, prev);
  };

  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const anchor = e.composedPath().find((n): n is HTMLAnchorElement => n instanceof HTMLAnchorElement && n.hasAttribute('href'));
    if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
    const url = new URL(anchor.href, win.location.href);
    if (url.origin !== win.location.origin) return;
    if (/\.[a-z0-9]+$/i.test(url.pathname)) return; // files (sitemap.xml, images)
    if (url.pathname === win.location.pathname && url.hash) return; // in-page anchors: native behavior
    e.preventDefault();
    go(url.pathname + url.search + url.hash, false);
  };

  const onPop = () => {
    const prev = current;
    current = matchRoute(win.location.pathname);
    if (current.path !== prev.path) void onRoute(current, prev);
  };

  win.document.addEventListener('click', onClick);
  win.addEventListener('popstate', onPop);
  const offNav = bus.subscribe('nav:request', ({ path, replace }) => go(path, !!replace));

  return {
    get current() {
      return current;
    },
    navigate: (path, opts) => go(path, !!opts?.replace),
    dispose() {
      win.document.removeEventListener('click', onClick);
      win.removeEventListener('popstate', onPop);
      offNav();
    },
  };
}
