import { provideZonelessChangeDetection } from '@angular/core';
import { createApplication } from '@angular/platform-browser';
import type { CareerContentBundle } from '@befreeman/content';
import { adoptStyles, createShadowStyles } from '@befreeman/design-system';
import { defineRemote } from '@befreeman/mfe-contract';
import css from './styles.css?inline';
import { AppComponent } from './app/app.component';
import { AchievementsStore, STORE } from './app/store';

/** Achievements remote (Angular, zoneless). Exposed as `./mount`. */
export const mount = defineRemote<CareerContentBundle>(async (el, ctx) => {
  const root = el.getRootNode();
  if (root instanceof ShadowRoot) adoptStyles(root, createShadowStyles(css));

  const store = new AchievementsStore(ctx.bus);
  store.apply(ctx);

  const appRef = await createApplication({
    providers: [provideZonelessChangeDetection(), { provide: STORE, useValue: store }],
  });
  const host = document.createElement('bf-achievements-root');
  el.append(host);
  appRef.bootstrap(AppComponent, host);

  return {
    async unmount() {
      store.dispose();
      appRef.destroy();
      host.remove();
    },
    update(next) {
      store.apply(next);
    },
  };
});

export default mount;
