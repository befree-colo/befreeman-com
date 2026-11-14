import { createScopedBus } from './bus';
import type { EventBus } from './bus';
import type { Theme } from './events';

export interface RemoteRoute {
  /** Full top-level path, e.g. `/achievements/cloud-migration`. */
  path: string;
  /** Remainder after the owning prefix, e.g. `cloud-migration` (empty string at the root). */
  subPath: string;
  query: URLSearchParams;
}

export interface RemoteMeta {
  name: string;
  version: string;
  framework: string;
}

/**
 * Everything the shell hands a remote at mount time.
 * `TContent` defaults to the career content bundle type; it is generic so the
 * contract library has no runtime dependency on the content package.
 */
export interface RemoteContext<TContent = unknown> {
  route: RemoteRoute;
  content: TContent;
  bus: EventBus;
  theme: Theme;
  meta: RemoteMeta;
}

export interface RemoteInstance<TContent = unknown> {
  unmount(): Promise<void>;
  update?(ctx: RemoteContext<TContent>): void;
}

export type Mount<TContent = unknown> = (
  el: HTMLElement,
  ctx: RemoteContext<TContent>,
) => Promise<RemoteInstance<TContent>>;

/** The module shape every remote exposes as `./mount`. */
export interface RemoteModule<TContent = unknown> {
  mount: Mount<TContent>;
}

/**
 * Wraps a remote's framework-specific mount so that:
 * - every bus subscription made through `ctx.bus` is removed on unmount, and
 * - unmount is idempotent and always empties the host element.
 */
export function defineRemote<TContent = unknown>(mountImpl: Mount<TContent>): Mount<TContent> {
  return async (el, ctx) => {
    const bus = createScopedBus(ctx.bus);
    let instance: RemoteInstance<TContent>;
    try {
      instance = await mountImpl(el, { ...ctx, bus });
    } catch (error) {
      bus.disposeAll();
      el.replaceChildren();
      throw error;
    }
    let unmounted = false;
    return {
      async unmount() {
        if (unmounted) return;
        unmounted = true;
        bus.disposeAll();
        try {
          await instance.unmount();
        } finally {
          el.replaceChildren();
        }
      },
      ...(instance.update ? { update: (next: RemoteContext<TContent>) => instance.update?.({ ...next, bus }) } : {}),
    };
  };
}
