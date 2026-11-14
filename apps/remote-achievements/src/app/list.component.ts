import { CUSTOM_ELEMENTS_SCHEMA, ChangeDetectionStrategy, Component, ElementRef, effect, inject } from '@angular/core';
import type { ChipToggleDetail } from '@befreeman/ui-components/types';
import { STORE } from './store';

@Component({
  selector: 'bf-achievement-list',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.view() === 'list') {
      <div class="mb-8 space-y-4" role="group" aria-label="Filter achievements">
        <div class="flex flex-wrap items-center gap-2">
          <span class="mr-1 font-mono text-xs uppercase tracking-widest text-ink-muted">Technology</span>
          @for (s of store.technologies(); track s.id) {
            <bf-chip interactive [value]="s.id" [selected]="store.techFilter() === s.id" (bf-toggle)="onTech($event)">{{ s.name }}</bf-chip>
          }
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="mr-1 font-mono text-xs uppercase tracking-widest text-ink-muted">Role</span>
          @for (r of store.content().roles; track r.id) {
            <bf-chip interactive [value]="r.id" [selected]="store.roleFilter() === r.id" (bf-toggle)="onRole($event)">{{ r.company }}</bf-chip>
          }
        </div>
        <p class="text-sm text-ink-muted" aria-live="polite" data-testid="result-count">
          Showing {{ store.visible().length }} of {{ store.content().achievements.length }} achievements
        </p>
      </div>
    }
    <ul class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-testid="achievement-list">
      @for (a of store.visible(); track a.id) {
        <li [attr.data-entity-id]="a.id" [attr.data-focused]="store.isFocused(a) ? 'true' : null">
          <bf-card variant="raised" [href]="'/achievements/' + a.id" [highlighted]="store.isFocused(a)" (click)="store.navigate('/achievements/' + a.id, $event)">
            <span slot="heading">{{ a.title }}</span>
            @if (store.roles().get(a.role); as role) {
              <span class="block text-sm">{{ role.title }} · {{ role.company }}</span>
            }
            <span class="mt-3 block">{{ a.summary }}</span>
            <span slot="footer" class="flex flex-wrap gap-2">
              @for (id of a.skills; track id) {
                <bf-chip>{{ store.skills().get(id)?.name ?? id }}</bf-chip>
              }
            </span>
          </bf-card>
        </li>
      } @empty {
        <li class="col-span-full rounded-lg bg-surface-sunken p-8 text-center text-ink-muted">
          No achievements match these filters.
          <button type="button" class="ml-2 font-semibold text-accent underline" (click)="clear()">Clear filters</button>
        </li>
      }
    </ul>
  `,
})
export class AchievementListComponent {
  readonly store = inject(STORE);
  private readonly host = inject(ElementRef<HTMLElement>);

  constructor() {
    effect(() => {
      const f = this.store.focus();
      if (!f) return;
      const target = this.store.visible().find((a) => this.store.isFocused(a));
      if (!target) return;
      queueMicrotask(() =>
        (this.host.nativeElement as HTMLElement)
          .querySelector(`[data-entity-id="${target.id}"]`)
          ?.scrollIntoView({ block: 'center', behavior: this.store.scrollBehavior() }),
      );
    });
  }

  onTech(e: CustomEvent<ChipToggleDetail>): void {
    this.store.setFilter('tech', e.detail.selected ? (e.detail.value ?? null) : null);
  }

  onRole(e: CustomEvent<ChipToggleDetail>): void {
    this.store.setFilter('role', e.detail.selected ? (e.detail.value ?? null) : null);
  }

  clear(): void {
    this.store.setFilter('tech', null);
    this.store.setFilter('role', null);
  }
}
