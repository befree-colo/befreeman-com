import { CONTRACT_VERSION, eventCatalog, isEventName } from './events';
import type { EventEnvelope, EventName, EventPayload } from './events';

const GLOBAL_KEY = '__befreemanBus__';
const DOM_EVENT_PREFIX = 'bf:';

type Handler<N extends EventName> = (payload: EventPayload<N>, envelope: EventEnvelope<N>) => void;
export type Disposer = () => void;

interface GlobalBusState {
  target: EventTarget;
  diagnostics: boolean;
}

type BusGlobal = typeof globalThis & { [GLOBAL_KEY]?: GlobalBusState };

/**
 * One EventTarget per page, stored on globalThis so every bundled copy of this
 * library (each remote ships its own) shares the same channel.
 */
function state(): GlobalBusState {
  const g = globalThis as BusGlobal;
  g[GLOBAL_KEY] ??= { target: new EventTarget(), diagnostics: true };
  return g[GLOBAL_KEY];
}

/** Turn publish-time diagnostics on (development) or off (production). Called by the shell. */
export function configureBus(options: { diagnostics: boolean }): void {
  state().diagnostics = options.diagnostics;
}

export interface EventBus {
  publish<N extends EventName>(name: N, payload: EventPayload<N>): boolean;
  subscribe<N extends EventName>(name: N, handler: Handler<N>): Disposer;
}

export interface ScopedEventBus extends EventBus {
  /** Remove every subscription made through this scope. */
  disposeAll(): void;
  readonly size: number;
}

class PageEventBus implements EventBus {
  constructor(private readonly source?: string) {}

  publish<N extends EventName>(name: N, payload: EventPayload<N>): boolean {
    const s = state();
    if (!isEventName(name)) {
      if (s.diagnostics) console.warn(`[bf-bus] dropped unknown event "${String(name)}"`);
      return false;
    }
    const result = eventCatalog[name].safeParse(payload);
    if (!result.success) {
      if (s.diagnostics) {
        console.warn(`[bf-bus] dropped "${name}": payload does not match its schema`, result.error.issues);
      }
      return false;
    }
    const envelope: EventEnvelope<N> = {
      v: CONTRACT_VERSION,
      name,
      payload: result.data as EventPayload<N>,
      ...(this.source ? { source: this.source } : {}),
    };
    s.target.dispatchEvent(new CustomEvent(DOM_EVENT_PREFIX + name, { detail: envelope }));
    return true;
  }

  subscribe<N extends EventName>(name: N, handler: Handler<N>): Disposer {
    const target = state().target;
    const listener = (event: Event) => {
      const envelope = (event as CustomEvent<EventEnvelope<N>>).detail;
      if (!envelope || envelope.v !== CONTRACT_VERSION) return;
      try {
        handler(envelope.payload, envelope);
      } catch (error) {
        // A failing subscriber must never break the publisher or other subscribers.
        console.error(`[bf-bus] subscriber for "${name}" threw`, error);
      }
    };
    target.addEventListener(DOM_EVENT_PREFIX + name, listener);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      target.removeEventListener(DOM_EVENT_PREFIX + name, listener);
    };
  }
}

class Scoped implements ScopedEventBus {
  private readonly disposers = new Set<Disposer>();
  constructor(private readonly inner: EventBus) {}

  get size(): number {
    return this.disposers.size;
  }

  publish<N extends EventName>(name: N, payload: EventPayload<N>): boolean {
    return this.inner.publish(name, payload);
  }

  subscribe<N extends EventName>(name: N, handler: Handler<N>): Disposer {
    const dispose = this.inner.subscribe(name, handler);
    const tracked = () => {
      this.disposers.delete(tracked);
      dispose();
    };
    this.disposers.add(tracked);
    return tracked;
  }

  disposeAll(): void {
    for (const dispose of [...this.disposers]) dispose();
  }
}

/** The page-wide bus. `source` tags published envelopes for debugging. */
export function getBus(source?: string): EventBus {
  return new PageEventBus(source);
}

/** A bus whose subscriptions can all be removed at once, e.g. on remote unmount. */
export function createScopedBus(inner: EventBus = getBus()): ScopedEventBus {
  return new Scoped(inner);
}
