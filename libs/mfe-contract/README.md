# @befreeman/mfe-contract

The only thing the shell and the remotes share at runtime. It defines:

- the **mount contract** every remote exposes as `./mount`, and
- the **typed event bus** the shell and remotes use to coordinate without importing each other.

No UI framework is involved: Angular, React, and Vue remotes all use the same API.

## Mount contract

```ts
import { defineRemote } from '@befreeman/mfe-contract';
import type { RemoteContext } from '@befreeman/mfe-contract';

export const mount = defineRemote(async (el: HTMLElement, ctx: RemoteContext) => {
  el.textContent = `Hello from ${ctx.meta.name} at ${ctx.route.path}`;
  return {
    async unmount() {
      // tear down your framework app here
    },
  };
});
```

The shell calls `mount(el, ctx)` with a host element and a `RemoteContext`:

| Field | Meaning |
|---|---|
| `route` | `path` (full URL path), `subPath` (the part after this remote's prefix), `query` |
| `content` | the validated career content bundle |
| `bus` | the event bus, scoped to this remote |
| `theme` | the current mode, `'light'` or `'dark'` |
| `meta` | this remote's `name`, `version`, and `framework` from the manifest |

The remote resolves to `{ unmount(), update?(ctx) }`.

Always wrap your mount in `defineRemote`. It guarantees that:
- every subscription made through `ctx.bus` is removed on unmount, so an unmounted remote never receives events;
- the host element is emptied on unmount, and when mount throws;
- `unmount` is idempotent.

## Event bus

```ts
import { getBus } from '@befreeman/mfe-contract';

const bus = getBus('timeline'); // the argument tags events for debugging
const off = bus.subscribe('entity:focus', ({ type, id }) => {
  console.log(`highlight ${type} ${id}`);
});
bus.publish('nav:request', { path: '/achievements/cloud-migration' });
off();
```

All bundled copies of this library share one page-wide channel, an `EventTarget` stored at `globalThis.__befreemanBus__`. A remote can therefore bundle its own copy and still talk to everyone else.

Payloads are validated against the catalog when published. Invalid events are **dropped** and never reach subscribers, with a `console.warn` unless the shell called `configureBus({ diagnostics: false })` in production. `publish` returns `false` when an event is dropped. A throwing subscriber is isolated from the publisher and from other subscribers.

### Event catalog (contract v1)

| Event | Payload | Who publishes | Who acts |
|---|---|---|---|
| `nav:request` | `{ path, replace? }` | anyone | **shell only**; remotes never navigate the top-level URL themselves |
| `route:changed` | `{ path, subPath, owner }` | **shell only** | remotes syncing their sub-route |
| `entity:focus` | `{ type: 'profile'\|'role'\|'achievement'\|'caseStudy'\|'skill', id }` | anyone (later the agent) | every remote showing that entity highlights it and scrolls it into view; others ignore it |
| `theme:changed` | `{ theme: 'light'\|'dark' }` | **shell only** | remotes with JS-drawn visuals (CSS follows automatically) |
| `remote:error` | `{ name, version, phase: 'load'\|'mount'\|'unmount'\|'runtime', message }` | **shell only** | diagnostics and the architecture view |

## Versioning rules

Every event carries `v` (`CONTRACT_VERSION`, currently `1`). Subscribers ignore envelopes with a different `v`.

- **Additive changes do not bump `v`**: a new event name, or a new **optional** payload field. Publish a new library minor version.
- **Breaking changes bump `v`** (major): removing or renaming an event, adding a required field, or narrowing or changing a field's type. Roll out a breaking change in this order:
  1. Release remotes that understand both versions.
  2. Release the shell.
  3. Drop the old version.
- `RemoteContext` follows the same rules. Adding optional fields is a minor change; anything else is a major change and needs every remote re-released.

The examples above are compiled in `test/readme-examples.typecheck.ts` by `nx typecheck mfe-contract`.
