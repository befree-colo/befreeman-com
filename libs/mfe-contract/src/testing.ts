/**
 * Test helpers for remote contract tests (`@befreeman/mfe-contract/testing`).
 * Not part of the runtime contract; import only from tests.
 */
import { getBus } from './bus';
import type { EventBus } from './bus';
import type { EventName, EventPayload } from './events';
import type { Mount, RemoteContext, RemoteInstance } from './remote';

export interface CountingBus extends EventBus {
  /** Subscriptions currently active through this bus. */
  live(): number;
  published: { name: EventName; payload: unknown }[];
}

/** A page bus wrapper that counts live subscriptions, proving remotes leave none behind. */
export function countingBus(source = 'shell'): CountingBus {
  const inner = getBus(source);
  let live = 0;
  const published: { name: EventName; payload: unknown }[] = [];
  return {
    live: () => live,
    published,
    publish<N extends EventName>(name: N, payload: EventPayload<N>) {
      published.push({ name, payload });
      return inner.publish(name, payload);
    },
    subscribe(name, handler) {
      live++;
      const off = inner.subscribe(name, handler);
      let done = false;
      return () => {
        if (done) return;
        done = true;
        live--;
        off();
      };
    },
  };
}

export interface MountedRemote<TContent> {
  host: HTMLElement;
  root: ShadowRoot;
  el: HTMLElement;
  instance: RemoteInstance<TContent>;
  bus: CountingBus;
  ctx: RemoteContext<TContent>;
}

/** Mount a remote the way the shell does: inside an open shadow root, with a full context. */
export async function mountInShadow<TContent>(
  mount: Mount<TContent>,
  ctx: Omit<RemoteContext<TContent>, 'bus' | 'route'> & { route?: Partial<RemoteContext<TContent>['route']> },
): Promise<MountedRemote<TContent>> {
  const host = document.createElement('div');
  document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  const el = document.createElement('div');
  root.append(el);
  const bus = countingBus();
  const full: RemoteContext<TContent> = {
    ...ctx,
    route: { path: '/', subPath: '', query: new URLSearchParams(), ...ctx.route },
    bus,
  };
  const instance = await mount(el, full);
  return { host, root, el, instance, bus, ctx: full };
}

/** Let framework schedulers (microtasks, zero-delay timers) flush. */
export async function settle(rounds = 3): Promise<void> {
  for (let i = 0; i < rounds; i++) await new Promise((r) => setTimeout(r, 0));
}
