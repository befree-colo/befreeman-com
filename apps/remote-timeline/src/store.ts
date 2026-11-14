import { computed, reactive, readonly } from 'vue';
import type { InjectionKey } from 'vue';
import type { Achievement, CareerContentBundle } from '@befreeman/content';
import type { EventBus, RemoteContext } from '@befreeman/mfe-contract';
import { resolveMotion } from '@befreeman/design-system';

export type ViewMode = 'timeline' | 'list';

export function createTimelineStore(ctx: RemoteContext<CareerContentBundle>) {
  const state = reactive({
    content: ctx.content,
    path: ctx.route.path,
    expanded: new Set<string>(),
    focused: null as string | null,
    mode: 'timeline' as ViewMode,
  });
  const bus: EventBus = ctx.bus;

  const achievementsByRole = computed(() => {
    const map = new Map<string, Achievement[]>();
    for (const a of state.content.achievements) map.set(a.role, [...(map.get(a.role) ?? []), a]);
    return map;
  });

  function focusRole(id: string, opts: { announce?: boolean } = {}) {
    if (!state.content.roles.some((r) => r.id === id)) return false;
    state.expanded.add(id);
    state.focused = id;
    if (opts.announce) bus.publish('entity:focus', { type: 'role', id });
    return true;
  }

  function toggle(id: string) {
    if (state.expanded.has(id)) {
      state.expanded.delete(id);
      if (state.focused === id) state.focused = null;
    } else {
      // Expanding a role tells the other remotes to highlight what belongs to it.
      focusRole(id, { announce: true });
    }
  }

  const off = bus.subscribe('entity:focus', ({ type, id }) => {
    if (type === 'role') focusRole(id);
    else if (type === 'achievement') {
      const a = state.content.achievements.find((x) => x.id === id);
      if (a) focusRole(a.role);
    }
  });

  return {
    state: readonly(state),
    achievementsByRole,
    toggle,
    focusRole,
    setMode: (mode: ViewMode) => (state.mode = mode),
    navigate: (path: string, e?: Event) => {
      e?.preventDefault();
      bus.publish('nav:request', { path });
    },
    apply: (next: RemoteContext<CareerContentBundle>) => {
      state.content = next.content;
      state.path = next.route.path;
    },
    motion: () => resolveMotion(),
    dispose: off,
  };
}

export type TimelineStore = ReturnType<typeof createTimelineStore>;
export const STORE: InjectionKey<TimelineStore> = Symbol('timeline-store');
