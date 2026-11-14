// Mirrors the README snippets so `nx typecheck mfe-contract` proves they compile.
import { defineRemote, getBus } from '../src';
import type { RemoteContext } from '../src';

export const mount = defineRemote(async (el: HTMLElement, ctx: RemoteContext) => {
  el.textContent = `Hello from ${ctx.meta.name} at ${ctx.route.path}`;
  return {
    async unmount() {
      // tear down your framework app here
    },
  };
});

const bus = getBus('timeline');
const off = bus.subscribe('entity:focus', ({ type, id }) => {
  console.log(`highlight ${type} ${id}`);
});
bus.publish('nav:request', { path: '/achievements/cloud-migration' });
off();
