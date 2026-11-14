<script setup lang="ts">
import { inject } from 'vue';
import { STORE } from '../store';
import { formatRange } from '../format';
import RoleItem from './RoleItem.vue';

const store = inject(STORE)!;
</script>

<template>
  <div class="text-ink" :data-mode="store.state.mode">
    <div class="mb-6 flex justify-end">
      <div class="inline-flex rounded-pill bg-surface-sunken p-1 ring-1 ring-border" role="group" aria-label="Timeline display">
        <button
          v-for="m in (['timeline', 'list'] as const)"
          :key="m"
          type="button"
          class="rounded-pill px-4 py-1.5 text-sm font-semibold"
          :class="store.state.mode === m ? 'bg-accent text-accent-ink' : 'text-ink-muted hover:text-ink'"
          :aria-pressed="store.state.mode === m ? 'true' : 'false'"
          @click="store.setMode(m)"
        >
          {{ m === 'timeline' ? 'Timeline' : 'List view' }}
        </button>
      </div>
    </div>

    <ol v-if="store.state.mode === 'timeline'" class="relative space-y-8 before:absolute before:top-2 before:bottom-2 before:left-2.5 before:w-0.5 before:bg-linear-to-b before:from-accent before:to-accent-2" data-testid="timeline">
      <RoleItem v-for="(role, i) in store.state.content.roles" :key="role.id" :role="role" :index="i" />
    </ol>

    <!-- Text alternative: the same facts as a plain, linear list. -->
    <ol v-else class="space-y-6" data-testid="list-view">
      <li v-for="role in store.state.content.roles" :key="role.id" :data-entity-id="role.id">
        <h3 class="font-display text-xl font-bold">{{ role.title }}, {{ role.company }}</h3>
        <p class="text-sm text-ink-muted">{{ formatRange(role.start, role.end) }}</p>
        <p class="mt-2">{{ role.summary }}</p>
        <ul class="mt-2 list-disc pl-5">
          <li v-for="r in role.responsibilities" :key="r">{{ r }}</li>
        </ul>
        <ul class="mt-2">
          <li v-for="a in store.achievementsByRole.value.get(role.id) ?? []" :key="a.id">
            Achievement: <a :href="`/achievements/${a.id}`" @click="store.navigate(`/achievements/${a.id}`, $event)">{{ a.title }}</a>
          </li>
        </ul>
      </li>
    </ol>
  </div>
</template>
