import type { DeploymentManifest, EventBus, RemoteContext, RemoteInstance } from '@befreeman/mfe-contract';
import type { CareerContentBundle } from '@befreeman/content';
import type { RemoteName, RouteMatch } from '@befreeman/page-templates';
import type { RemoteLoader } from './federation';
import { withTimeout } from './timeout';

export type RemoteState = 'pending' | 'mounting' | 'mounted' | 'failed';

export interface RemoteStatus {
  name: string;
  version: string;
  framework: string;
  state: RemoteState;
  error?: string;
}

export interface MountDeps {
  manifest: DeploymentManifest;
  loader: RemoteLoader;
  content: CareerContentBundle;
  bus: EventBus;
  theme: () => 'light' | 'dark';
  timeoutMs: number;
  onStatus?: (status: RemoteStatus) => void;
  /** Whether remotes may mount at all (false when the shared ui library failed). */
  canMount?: () => boolean;
}

const LABELS: Record<string, string> = {
  achievements: 'achievements view',
  timeline: 'timeline',
  skills: 'skills radar',
};

interface Active {
  name: RemoteName;
  slot: HTMLElement;
  host: HTMLElement | null;
  instance: RemoteInstance | null;
}

/**
 * Mounts remotes into their slots and keeps the page working when one fails:
 * each remote renders in its own shadow root, gets a load+mount time budget, and
 * on any error the slot's pre-rendered content stays visible with a notice.
 */
export class MountManager {
  private active: Active[] = [];
  private observer: IntersectionObserver | null = null;
  private generation = 0;
  readonly statuses = new Map<string, RemoteStatus>();

  constructor(private readonly deps: MountDeps) {}

  /** Mount every slot under `root` for `route`; lazily (near the viewport) when `lazy`. */
  mountRoute(route: RouteMatch, root: ParentNode, opts: { lazy: boolean }): Promise<void>[] {
    const gen = this.generation;
    const slots = [...root.querySelectorAll<HTMLElement>('[data-slot]')];
    const pending: Promise<void>[] = [];
    for (const slot of slots) {
      const name = slot.dataset['slot'] as RemoteName;
      this.markSlot(slot, name, 'pending');
      const entry: Active = { name, slot, host: null, instance: null };
      this.active.push(entry);
      if (opts.lazy && typeof IntersectionObserver !== 'undefined') {
        pending.push(
          new Promise<void>((resolve) => {
            this.observer ??= new IntersectionObserver(
              (entries) => {
                for (const e of entries) {
                  if (!e.isIntersecting) continue;
                  this.observer?.unobserve(e.target);
                  (e.target as HTMLElement & { __bfMount?: () => void }).__bfMount?.();
                }
              },
              { rootMargin: '300px 0px' },
            );
            (slot as HTMLElement & { __bfMount?: () => void }).__bfMount = () => void this.mountOne(entry, route, gen).then(resolve);
            this.observer.observe(slot);
          }),
        );
      } else {
        pending.push(this.mountOne(entry, route, gen));
      }
    }
    return pending;
  }

  async unmountAll(): Promise<void> {
    this.generation++;
    this.observer?.disconnect();
    this.observer = null;
    const current = this.active;
    this.active = [];
    await Promise.all(
      current.map(async (a) => {
        if (!a.instance) return;
        try {
          await a.instance.unmount();
        } catch (error) {
          this.report(a.name, 'unmount', error);
        } finally {
          a.host?.remove();
        }
      }),
    );
  }

  private manifestEntry(name: string) {
    return this.deps.manifest.remotes[name];
  }

  private setStatus(status: RemoteStatus) {
    this.statuses.set(status.name, status);
    this.deps.onStatus?.(status);
  }

  private markSlot(slot: HTMLElement, name: string, state: RemoteState, error?: string) {
    const entry = this.manifestEntry(name);
    slot.dataset['remoteState'] = state;
    slot.dataset['remoteFramework'] = entry?.framework ?? 'unknown';
    this.setStatus({
      name,
      version: entry?.version ?? 'n/a',
      framework: entry?.framework ?? 'unknown',
      state,
      ...(error ? { error } : {}),
    });
  }

  private context(name: string, route: RouteMatch): RemoteContext<CareerContentBundle> {
    const entry = this.manifestEntry(name);
    return {
      route: { path: route.path, subPath: route.owner === name ? route.subPath : '', query: new URLSearchParams(location.search) },
      content: this.deps.content,
      bus: this.deps.bus,
      theme: this.deps.theme(),
      meta: { name, version: entry?.version ?? 'n/a', framework: entry?.framework ?? 'unknown' },
    };
  }

  private report(name: string, phase: 'load' | 'mount' | 'unmount' | 'runtime', error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[shell] remote "${name}" failed during ${phase}:`, error);
    this.deps.bus.publish('remote:error', { name, version: this.manifestEntry(name)?.version ?? 'n/a', phase, message });
  }

  private async mountOne(entry: Active, route: RouteMatch, gen: number): Promise<void> {
    const { name, slot } = entry;
    const stale = () => gen !== this.generation || !slot.isConnected;
    const prerendered = slot.querySelector<HTMLElement>(':scope > [data-prerendered]');
    let phase: 'load' | 'mount' = 'load';
    this.markSlot(slot, name, 'mounting');
    try {
      if (this.deps.canMount && !this.deps.canMount()) throw new Error('shared ui components unavailable');
      if (!this.manifestEntry(name)) throw new Error(`remote "${name}" is not in the manifest`);
      const mod = await withTimeout(this.deps.loader.load(name), this.deps.timeoutMs, `loading ${name}`);
      if (stale()) return;

      phase = 'mount';
      const host = document.createElement('div');
      host.className = 'bf-remote-host';
      host.dataset['remote'] = name;
      host.dataset['state'] = 'mounting';
      const shadow = host.attachShadow({ mode: 'open' });
      const el = document.createElement('div');
      el.className = 'bf-remote-root';
      shadow.append(el);
      slot.append(host);
      entry.host = host;

      const instance = await withTimeout(mod.mount(el, this.context(name, route)), this.deps.timeoutMs, `mounting ${name}`);
      if (stale()) {
        await instance.unmount().catch(() => undefined);
        host.remove();
        return;
      }
      entry.instance = instance;
      // Swap in one frame: hide the static fallback, reveal the live remote.
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      if (prerendered) prerendered.hidden = true;
      host.dataset['state'] = 'mounted';
      slot.querySelector(':scope > .bf-remote-notice')?.remove();
      this.markSlot(slot, name, 'mounted');
    } catch (error) {
      entry.host?.remove();
      entry.host = null;
      if (prerendered) prerendered.hidden = false;
      if (!stale() && !slot.querySelector(':scope > .bf-remote-notice')) {
        const notice = document.createElement('p');
        notice.className = 'bf-remote-notice';
        notice.setAttribute('role', 'status');
        notice.textContent = `The interactive ${LABELS[name] ?? name} is unavailable right now, so you’re seeing a static version.`;
        slot.prepend(notice);
      }
      this.markSlot(slot, name, 'failed', error instanceof Error ? error.message : String(error));
      this.report(name, phase, error);
    }
  }
}
