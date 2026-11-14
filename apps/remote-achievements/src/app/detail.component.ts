import { CUSTOM_ELEMENTS_SCHEMA, ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { STORE } from './store';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ym = (v: string | undefined) => (v ? `${MONTHS[Number(v.slice(5)) - 1]} ${v.slice(0, 4)}` : '');

@Component({
  selector: 'bf-achievement-detail',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.current(); as a) {
      <article class="max-w-3xl" [attr.data-entity-id]="a.id" data-testid="achievement-detail">
        <p class="mb-3"><a class="text-sm" href="/achievements" (click)="store.navigate('/achievements', $event)">← All achievements</a></p>
        <h1 class="font-display text-4xl font-bold" [class.text-accent]="focused()">{{ a.title }}</h1>
        @if (role(); as r) {
          <p class="mt-3 text-ink-muted">
            <a [href]="'/timeline#' + r.id" (click)="store.navigate('/timeline#' + r.id, $event)" data-testid="role-link">{{ r.title }} · {{ r.company }}</a>
            @if (a.date) {
              <span> · {{ date() }}</span>
            }
          </p>
        }
        <p class="mt-6 text-xl">{{ a.summary }}</p>

        <h2 class="mt-10 font-display text-2xl font-bold">Impact</h2>
        <ul class="mt-4 space-y-3" data-testid="impact">
          @for (i of a.impact; track i) {
            <li class="flex gap-3"><span class="mt-2 size-2 shrink-0 rounded-pill bg-accent-2" aria-hidden="true"></span><span>{{ i }}</span></li>
          }
        </ul>

        @if (a.metrics?.length) {
          <dl class="mt-8 grid gap-4 sm:grid-cols-2" data-testid="metrics">
            @for (m of a.metrics; track m.label) {
              <div class="rounded-lg bg-surface-raised p-5 shadow-md ring-1 ring-border motion-safe:animate-rise">
                <dt class="text-sm text-ink-muted">{{ m.label }}</dt>
                <dd class="mt-1 font-display text-3xl font-bold text-accent">{{ m.value }}</dd>
              </div>
            }
          </dl>
        }

        <h2 class="mt-10 font-display text-2xl font-bold">Technologies</h2>
        <ul class="mt-4 flex flex-wrap gap-2" data-testid="technologies">
          @for (id of a.skills; track id) {
            <li>
              <a class="no-underline" [href]="'/skills#' + id" (click)="store.navigate('/skills#' + id, $event)">
                <bf-chip>{{ store.skills().get(id)?.name ?? id }}</bf-chip>
              </a>
            </li>
          }
        </ul>

        @if (a.bodyHtml) {
          <div class="mt-10 space-y-4 text-ink-muted [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-ink" [innerHTML]="a.bodyHtml"></div>
        }

        @if (caseStudy(); as c) {
          <section id="case-study" class="mt-12" data-testid="case-study">
            <bf-card variant="glow">
              <span slot="heading">Case study: {{ c.title }}</span>
              <span class="block">{{ c.summary }}</span>
              <div class="mt-6 space-y-4 text-ink [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold" [innerHTML]="c.bodyHtml"></div>
            </bf-card>
          </section>
        }
      </article>
    } @else {
      <div class="py-16" data-testid="not-found">
        <h1 class="font-display text-4xl font-bold">Achievement not found</h1>
        <p class="mt-4 text-ink-muted">There is no achievement called “{{ store.subPath() }}”.</p>
        <p class="mt-6"><bf-button href="/achievements" (click)="store.navigate('/achievements', $event)">See all achievements</bf-button></p>
      </div>
    }
  `,
})
export class AchievementDetailComponent {
  readonly store = inject(STORE);
  readonly role = computed(() => {
    const a = this.store.current();
    return a ? (this.store.roles().get(a.role) ?? null) : null;
  });
  readonly caseStudy = computed(() => {
    const a = this.store.current();
    return a?.caseStudy ? (this.store.content().caseStudies.find((c) => c.id === a.caseStudy) ?? null) : null;
  });
  readonly date = computed(() => ym(this.store.current()?.date));
  readonly focused = computed(() => {
    const a = this.store.current();
    return !!a && this.store.isFocused(a);
  });
}
