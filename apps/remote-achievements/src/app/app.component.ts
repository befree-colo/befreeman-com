import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AchievementDetailComponent } from './detail.component';
import { AchievementListComponent } from './list.component';
import { STORE } from './store';

@Component({
  selector: 'bf-achievements-root',
  imports: [AchievementListComponent, AchievementDetailComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block text-ink', '[attr.data-view]': 'store.view()' },
  template: `
    @if (store.view() === 'detail') {
      <bf-achievement-detail />
    } @else {
      <bf-achievement-list />
    }
  `,
})
export class AppComponent {
  readonly store = inject(STORE);
}
