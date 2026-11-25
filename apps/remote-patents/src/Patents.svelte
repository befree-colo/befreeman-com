<script lang="ts">
  import { formatDate, patentNumber, patentUrl } from '@befreeman/page-templates';
  import type { PatentsView } from './view.svelte';

  let { view }: { view: PatentsView } = $props();

  const patents = $derived(view.content.patents);
  const roles = $derived(new Map(view.content.roles.map((r) => [r.id, r])));
  const lede = $derived(
    `${patents.length} issued U.S. patent${patents.length === 1 ? '' : 's'}, each linked to its public record on Google Patents.`,
  );
</script>

<header class="mb-10 max-w-3xl">
  <p class="mb-3 font-mono text-sm uppercase tracking-[0.2em] text-accent">Inventions</p>
  <h1 id="patents-heading" class="font-display text-4xl font-bold">Patents</h1>
  <p class="mt-4 text-lg text-ink-muted">{lede}</p>
</header>
<ol class="grid gap-6" data-testid="patents">
  {#each patents as p (p.id)}
    {@const role = p.role ? roles.get(p.role) : undefined}
    <li id={p.id} data-entity-id={p.id} class="rounded-lg bg-surface-raised p-6 shadow-md ring-1 ring-border">
      <h2 class="font-display text-xl font-bold">
        <a href={patentUrl(p.number)} target="_blank" rel="noopener noreferrer"
          >{p.title}<span class="sr-only">{' (opens Google Patents in a new tab)'}</span></a
        >
      </h2>
      <p class="mt-2 font-mono text-sm text-ink-muted">
        {patentNumber(p.number)} · <time datetime={p.issued}>{formatDate(p.issued)}</time> · {p.assignee}
      </p>
      <p class="mt-3">{p.summary}</p>
      {#if role}
        <p class="mt-3 text-sm"><a href="/timeline#{role.id}">{role.title} · {role.company}</a></p>
      {/if}
    </li>
  {/each}
</ol>
