/**
 * Compile-time contract tests (run by `nx typecheck mfe-contract`).
 * Each block is an example adapter; `@ts-expect-error` lines must fail to compile.
 */
import { defineRemote, getBus } from '../src';
import type { Mount, RemoteContext, RemoteModule } from '../src';

interface DemoContent {
  profile: { name: string };
}

// A framework-agnostic adapter: render into `el`, return an unmount.
export const vanillaAdapter: Mount<DemoContent> = defineRemote<DemoContent>(async (el, ctx) => {
  const p = document.createElement('p');
  p.textContent = `${ctx.content.profile.name} @ ${ctx.route.subPath} (${ctx.theme})`;
  el.append(p);
  const off = ctx.bus.subscribe('entity:focus', (payload) => {
    const id: string = payload.id;
    p.dataset['focused'] = id;
  });
  return {
    async unmount() {
      off();
    },
    update(next) {
      p.textContent = next.content.profile.name;
    },
  };
});

// The exposed module shape.
export const remoteModule: RemoteModule<DemoContent> = { mount: vanillaAdapter };

// Publishing is checked against the catalog.
const bus = getBus('typecheck');
bus.publish('nav:request', { path: '/achievements/x' });
bus.publish('entity:focus', { type: 'role', id: 'acme' });
// @ts-expect-error unknown event names are rejected
bus.publish('nav:teleport', { path: '/' });
// @ts-expect-error payload must match the event schema
bus.publish('entity:focus', { type: 'planet', id: 'mars' });
// @ts-expect-error required payload fields are enforced
bus.publish('theme:changed', {});

// @ts-expect-error mount must resolve to an object with unmount()
export const badAdapter: Mount = async () => ({});

// @ts-expect-error context fields are typed
export const badContext = (ctx: RemoteContext<DemoContent>): number => ctx.content.profile.name;
