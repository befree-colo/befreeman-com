import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { BfElement } from '../base';

export interface ChipToggleDetail {
  selected: boolean;
  value: string | undefined;
}

/**
 * @tagname bf-chip
 * Tag or filter chip. With `interactive`, renders a toggle button (aria-pressed)
 * and fires `bf-toggle`.
 * @slot - label
 * @fires bf-toggle - CustomEvent<ChipToggleDetail> when an interactive chip is toggled
 * @csspart chip - the chip element
 */
export class BfChip extends BfElement {
  @property({ type: Boolean, reflect: true }) interactive = false;
  @property({ type: Boolean, reflect: true }) selected = false;
  @property() value: string | undefined;

  private toggle() {
    this.selected = !this.selected;
    this.dispatchEvent(
      new CustomEvent<ChipToggleDetail>('bf-toggle', {
        detail: { selected: this.selected, value: this.value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  override render() {
    const base =
      'inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-sm font-medium transition-colors duration-token-fast ease-standard';
    const look = this.selected
      ? 'bg-accent text-accent-ink'
      : 'bg-surface-sunken text-ink ring-1 ring-border';
    if (!this.interactive) return html`<span part="chip" class="${base} ${look}"><slot></slot></span>`;
    return html`<button
      part="chip"
      type="button"
      class="${base} ${look} cursor-pointer hover:ring-accent"
      aria-pressed=${this.selected ? 'true' : 'false'}
      @click=${this.toggle}
    >
      <slot></slot>
    </button>`;
  }
}
