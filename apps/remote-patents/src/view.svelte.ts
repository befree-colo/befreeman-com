import type { CareerContentBundle } from '@befreeman/content';

/** Reactive holder the shell's `update()` writes into; the component reads from it. */
export class PatentsView {
  content: CareerContentBundle = $state() as CareerContentBundle;

  constructor(content: CareerContentBundle) {
    this.content = content;
  }
}
