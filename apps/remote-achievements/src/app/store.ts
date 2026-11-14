import { InjectionToken, computed, signal } from '@angular/core';
import type { Achievement, CareerContentBundle, Role, Skill } from '@befreeman/content';
import type { EventBus, RemoteContext } from '@befreeman/mfe-contract';
import { prefersReducedMotion } from '@befreeman/design-system';

export type View = 'featured' | 'list' | 'detail';

export interface Focus {
  type: string;
  id: string;
}

/** All remote state as signals, fed from the shell's mount context. Zoneless-friendly. */
export class AchievementsStore {
  readonly content = signal<CareerContentBundle>(null as unknown as CareerContentBundle);
  readonly path = signal('/');
  readonly subPath = signal('');
  readonly query = signal(new URLSearchParams());
  readonly focus = signal<Focus | null>(null);

  readonly view = computed<View>(() => (this.subPath() ? 'detail' : this.path().startsWith('/achievements') ? 'list' : 'featured'));
  readonly roles = computed(() => new Map<string, Role>(this.content().roles.map((r) => [r.id, r])));
  readonly skills = computed(() => new Map<string, Skill>(this.content().skills.map((s) => [s.id, s])));
  readonly techFilter = computed(() => this.query().get('tech'));
  readonly roleFilter = computed(() => this.query().get('role'));

  /** Technologies that appear on at least one achievement, in skill order. */
  readonly technologies = computed(() => {
    const used = new Set(this.content().achievements.flatMap((a) => a.skills));
    return this.content().skills.filter((s) => used.has(s.id));
  });

  readonly visible = computed<Achievement[]>(() => {
    const all = this.content().achievements;
    if (this.view() === 'featured') return all.filter((a) => a.featured);
    const tech = this.techFilter();
    const role = this.roleFilter();
    return all.filter((a) => (!tech || a.skills.includes(tech)) && (!role || a.role === role));
  });

  readonly current = computed(() => this.content().achievements.find((a) => a.id === this.subPath()) ?? null);

  private offFocus: (() => void) | null = null;

  constructor(readonly bus: EventBus) {
    this.offFocus = bus.subscribe('entity:focus', (f) => this.focus.set(f));
  }

  apply(ctx: RemoteContext<CareerContentBundle>): void {
    this.content.set(ctx.content);
    this.path.set(ctx.route.path);
    this.subPath.set(ctx.route.subPath);
    this.query.set(new URLSearchParams(ctx.route.query));
  }

  isFocused(a: Achievement): boolean {
    const f = this.focus();
    if (!f) return false;
    return (f.type === 'achievement' && f.id === a.id) || (f.type === 'role' && f.id === a.role) || (f.type === 'skill' && a.skills.includes(f.id));
  }

  navigate(path: string, event?: Event): void {
    event?.preventDefault();
    this.bus.publish('nav:request', { path });
  }

  /** Update filters locally and reflect them in the URL (replace, no re-route). */
  setFilter(key: 'tech' | 'role', value: string | null): void {
    const next = new URLSearchParams(this.query());
    if (value) next.set(key, value);
    else next.delete(key);
    this.query.set(next);
    const qs = next.toString();
    this.bus.publish('nav:request', { path: `${this.path()}${qs ? `?${qs}` : ''}`, replace: true });
  }

  scrollBehavior(): ScrollBehavior {
    return prefersReducedMotion() ? 'auto' : 'smooth';
  }

  dispose(): void {
    this.offFocus?.();
    this.offFocus = null;
  }
}

export const STORE = new InjectionToken<AchievementsStore>('AchievementsStore');
