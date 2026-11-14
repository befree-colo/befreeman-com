import { html } from 'lit';
import { property, query } from 'lit/decorators.js';
import { BfElement, deepActiveElement } from '../base';

/**
 * @tagname bf-dialog
 * Modal dialog built on native <dialog>: focus moves in, the rest of the page is
 * inert (focus trap), Escape closes, and focus returns to the opener.
 * @slot heading - dialog title (also its accessible name)
 * @slot - body
 * @slot footer - actions
 * @fires bf-close - after the dialog closes
 * @csspart dialog - the native dialog
 */
export class BfDialog extends BfElement {
  @property({ type: Boolean, reflect: true }) open = false;
  /** Accessible label for the close button. */
  @property({ attribute: 'close-label' }) closeLabel = 'Close';

  @query('dialog') private dialogEl!: HTMLDialogElement;
  private returnFocusTo: HTMLElement | null = null;

  show(): void {
    this.open = true;
  }

  close(): void {
    this.open = false;
  }

  protected override updated(changed: Map<string, unknown>): void {
    if (!changed.has('open')) return;
    if (this.open && !this.dialogEl.open) {
      const active = deepActiveElement();
      this.returnFocusTo = active instanceof HTMLElement ? active : null;
      this.dialogEl.showModal();
    } else if (!this.open && this.dialogEl.open) {
      this.dialogEl.close();
    }
  }

  private onNativeClose = () => {
    this.open = false;
    const target = this.returnFocusTo;
    this.returnFocusTo = null;
    target?.focus();
    this.dispatchEvent(new CustomEvent('bf-close', { bubbles: true, composed: true }));
  };

  private onBackdropClick = (e: MouseEvent) => {
    if (e.target === this.dialogEl) this.close();
  };

  override render() {
    return html`<dialog
      part="dialog"
      aria-labelledby="heading"
      class="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-xl bg-surface-raised p-0 text-ink shadow-lg backdrop:bg-black/60 open:animate-rise"
      @close=${this.onNativeClose}
      @click=${this.onBackdropClick}
    >
      <div class="p-6 sm:p-8">
        <div class="flex items-start justify-between gap-4">
          <h2 id="heading" class="font-display text-2xl font-bold"><slot name="heading"></slot></h2>
          <button
            type="button"
            class="-m-2 rounded-pill p-2 text-ink-muted hover:text-ink"
            aria-label=${this.closeLabel}
            @click=${() => this.close()}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div class="mt-4 text-ink-muted"><slot></slot></div>
        <div class="mt-6 flex flex-wrap justify-end gap-3 empty:hidden"><slot name="footer"></slot></div>
      </div>
    </dialog>`;
  }
}
