import './styles.css';
import { configureBus, getBus } from '@befreeman/mfe-contract';
import type { CareerContentBundle } from '@befreeman/content';
import { footer, matchRoute, pageTitle, routeView } from '@befreeman/page-templates';
import type { RouteMatch } from '@befreeman/page-templates';
import { ArchitectureView } from './app/arch-view';
import { initContact } from './app/contact';
import { PRODUCTION, REMOTE_TIMEOUT_MS, UI_TIMEOUT_MS } from './app/env';
import { createRemoteLoader } from './app/federation';
import { fetchContent, fetchManifest } from './app/manifest';
import { MountManager } from './app/mounts';
import { createRouter } from './app/router';
import { createThemeController } from './app/theme';
import { loadUi } from './app/ui-loader';

function renderChrome(doc: Document, content: CareerContentBundle) {
  const brand = doc.querySelector('[data-brand]');
  if (brand) brand.textContent = content.profile.name;
  const foot = doc.getElementById('contact');
  if (foot && foot.children.length === 0) foot.innerHTML = footer(content).__html;
}

function renderView(doc: Document, route: RouteMatch, content: CareerContentBundle, force: boolean) {
  const main = doc.getElementById('main');
  if (!main) throw new Error('missing <main id="main">');
  // Keep pre-rendered HTML for the initial page; render client-side otherwise.
  if (force || main.dataset['routePath'] !== route.path) {
    main.innerHTML = routeView(route, content).__html;
    main.dataset['routePath'] = route.path;
  }
  doc.title = pageTitle(route, content);
  return main;
}

async function bootstrap(doc: Document = document): Promise<void> {
  configureBus({ diagnostics: !PRODUCTION });
  const bus = getBus('shell');
  const theme = createThemeController(bus);
  let mounts: MountManager | null = null;
  const arch = new ArchitectureView(
    doc,
    doc.getElementById('arch-toggle') as HTMLButtonElement | null,
    null,
    () => mounts?.statuses ?? new Map(),
  );

  const manifest = await fetchManifest();
  const content = await fetchContent(manifest.content.url);
  renderChrome(doc, content);
  initContact(doc, content);

  let uiReady = false;
  const ui = loadUi(manifest.ui.entry, UI_TIMEOUT_MS).then(
    () => {
      uiReady = true;
    },
    (error: unknown) => {
      console.error('[shell] shared ui components failed to load', error);
      bus.publish('remote:error', { name: 'ui', version: manifest.ui.version, phase: 'load', message: String(error) });
    },
  );

  mounts = new MountManager({
    manifest,
    loader: createRemoteLoader(manifest),
    content,
    bus,
    theme: () => theme.current,
    timeoutMs: REMOTE_TIMEOUT_MS,
    canMount: () => uiReady,
    onStatus: () => arch.refresh(),
  });
  const remotes = mounts;
  arch.setManifest(manifest);

  const show = async (route: RouteMatch, prev: RouteMatch | null) => {
    await remotes.unmountAll();
    const main = renderView(doc, route, content, prev !== null);
    arch.refresh();
    if (prev) {
      window.scrollTo({ top: 0 });
      main.focus({ preventScroll: true });
    }
    bus.publish('route:changed', { path: route.path, subPath: route.subPath, owner: route.owner });
    await ui;
    remotes.mountRoute(route, main, { lazy: route.kind === 'home' });
  };

  const router = createRouter(bus, (route, prev) => show(route, prev));
  await show(router.current ?? matchRoute(location.pathname), null);
  doc.documentElement.dataset['shellReady'] = 'true';
}

bootstrap().catch((error: unknown) => {
  console.error('[shell] failed to start; the pre-rendered page remains usable', error);
  document.documentElement.dataset['shellError'] = 'true';
});
