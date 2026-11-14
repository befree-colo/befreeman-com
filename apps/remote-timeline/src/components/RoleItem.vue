<script setup lang="ts">
import { computed, inject, ref, watch, nextTick } from 'vue';
import type { DeepReadonly } from 'vue';
import type { Role } from '@befreeman/content';
import { STORE } from '../store';
import { formatRange } from '../format';

const props = defineProps<{ role: DeepReadonly<Role>; index: number }>();
const store = inject(STORE)!;
const item = ref<HTMLElement | null>(null);

const expanded = computed(() => store.state.expanded.has(props.role.id));
const focused = computed(() => store.state.focused === props.role.id);
const achievements = computed(() => store.achievementsByRole.value.get(props.role.id) ?? []);
const panelId = computed(() => `role-panel-${props.role.id}`);
const duration = computed(() => store.motion().durations.slow);

watch(focused, async (now) => {
  if (!now) return;
  await nextTick();
  item.value?.scrollIntoView({ block: 'center', behavior: store.motion().reduced ? 'auto' : 'smooth' });
});

function enter(el: Element, done: () => void) {
  const node = el as HTMLElement;
  if (duration.value === 0 || typeof node.animate !== 'function') return done();
  node.animate([{ opacity: 0, transform: 'translateY(-0.5rem)' }, { opacity: 1, transform: 'none' }], {
    duration: duration.value,
    easing: store.motion().easings.emphasized,
  }).onfinish = done;
}
</script>

<template>
  <li
    :id="role.id"
    ref="item"
    class="relative pl-10"
    :data-entity-id="role.id"
    :data-focused="focused ? 'true' : undefined"
    :style="{ '--i': index }"
  >
    <span
      class="absolute top-2 left-0 grid size-5 place-items-center rounded-pill ring-4 ring-surface transition-colors duration-token-base"
      :class="focused ? 'bg-accent-2' : 'bg-accent'"
      aria-hidden="true"
    />
    <bf-card :variant="focused ? 'glow' : 'raised'" :highlighted="focused" class="block motion-safe:animate-rise">
      <span slot="heading" class="flex flex-col gap-1">
        <span class="font-mono text-sm font-normal text-ink-muted">{{ formatRange(role.start, role.end) }}</span>
        <span>{{ role.title }}</span>
        <span class="text-base font-semibold text-accent">{{ role.company }}</span>
      </span>
      <p class="text-ink-muted">{{ role.summary }}</p>
      <button
        type="button"
        class="mt-4 inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-sm font-semibold text-accent ring-1 ring-border hover:ring-accent"
        :aria-expanded="expanded ? 'true' : 'false'"
        :aria-controls="panelId"
        data-testid="expand"
        @click="store.toggle(role.id)"
      >
        {{ expanded ? 'Show less' : 'Responsibilities & achievements' }}
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"
          class="transition-transform duration-token-base" :class="expanded ? 'rotate-180' : ''"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <Transition :css="false" @enter="enter">
        <div v-if="expanded" :id="panelId" class="mt-5 space-y-5 text-ink" data-testid="panel">
          <div>
            <h4 class="font-display text-lg font-bold">Responsibilities</h4>
            <ul class="mt-2 list-disc space-y-1 pl-5">
              <li v-for="r in role.responsibilities" :key="r">{{ r }}</li>
            </ul>
          </div>
          <!-- eslint-disable-next-line vue/no-v-html -- trusted: markdown rendered at build time from the repo -->
          <div v-if="role.bodyHtml" class="text-ink-muted" v-html="role.bodyHtml" />
          <div v-if="achievements.length">
            <h4 class="font-display text-lg font-bold">Achievements</h4>
            <ul class="mt-2 space-y-2">
              <li v-for="a in achievements" :key="a.id">
                <a :href="`/achievements/${a.id}`" class="font-semibold" @click="store.navigate(`/achievements/${a.id}`, $event)">{{ a.title }}</a>
                <span class="block text-sm text-ink-muted">{{ a.summary }}</span>
              </li>
            </ul>
          </div>
        </div>
      </Transition>
    </bf-card>
  </li>
</template>
