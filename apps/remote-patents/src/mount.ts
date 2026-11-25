import { mount as mountSvelte, unmount as unmountSvelte } from 'svelte';
import type { CareerContentBundle } from '@befreeman/content';
import { adoptStyles, createShadowStyles } from '@befreeman/design-system';
import { defineRemote } from '@befreeman/mfe-contract';
import css from './styles.css?inline';
import Patents from './Patents.svelte';
import { PatentsView } from './view.svelte';

/** Patents remote (Svelte), exposed as `./mount`. The shell mounts it into a shadow root. */
export const mount = defineRemote<CareerContentBundle>(async (el, ctx) => {
  const root = el.getRootNode();
  if (root instanceof ShadowRoot) adoptStyles(root, createShadowStyles(css));

  const view = new PatentsView(ctx.content);
  const app = mountSvelte(Patents, { target: el, props: { view } });

  // Deep links such as /patents#us12530268b2 scroll to that patent.
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash) {
    const target = [...el.querySelectorAll<HTMLElement>('[data-entity-id]')].find((n) => n.dataset['entityId'] === hash);
    target?.scrollIntoView({ block: 'start' });
  }

  return {
    async unmount() {
      await unmountSvelte(app);
    },
    update(next) {
      view.content = next.content;
    },
  };
});

export default mount;
