import { createApp } from 'vue';
import type { CareerContentBundle } from '@befreeman/content';
import { adoptStyles, createShadowStyles } from '@befreeman/design-system';
import { defineRemote } from '@befreeman/mfe-contract';
import css from './styles.css?inline';
import Timeline from './components/Timeline.vue';
import { STORE, createTimelineStore } from './store';

/** Career timeline remote (Vue). Exposed as `./mount`. */
export const mount = defineRemote<CareerContentBundle>(async (el, ctx) => {
  const root = el.getRootNode();
  if (root instanceof ShadowRoot) adoptStyles(root, createShadowStyles(css));

  const store = createTimelineStore(ctx);
  // Deep links such as /timeline#<role-id> focus that role.
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash) store.focusRole(hash);

  const app = createApp(Timeline);
  app.config.compilerOptions.isCustomElement = (tag) => tag.startsWith('bf-');
  app.provide(STORE, store);
  app.mount(el);

  return {
    async unmount() {
      store.dispose();
      app.unmount();
    },
    update(next) {
      store.apply(next);
    },
  };
});

export default mount;
