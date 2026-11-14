import { html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { BfElement } from '../base';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink shadow-md hover:shadow-glow hover:-translate-y-0.5',
  secondary: 'bg-surface-raised text-ink ring-1 ring-border hover:ring-accent hover:-translate-y-0.5',
  ghost: 'bg-transparent text-accent hover:bg-surface-raised',
};
const sizes: Record<ButtonSize, string> = {
  sm: 'text-sm px-3 py-1.5 gap-1.5',
  md: 'text-base px-5 py-2.5 gap-2',
  lg: 'text-lg px-7 py-3.5 gap-2.5',
};

/**
 * @tagname bf-button
 * Button or link with the shared look.
 * @slot - label
 * @slot icon - optional leading icon
 * @csspart control - the native <button> or <a>
 */
export class BfButton extends BfElement {
  @property({ reflect: true }) variant: ButtonVariant = 'primary';
  @property({ reflect: true }) size: ButtonSize = 'md';
  /** Renders a link instead of a button. */
  @property() href: string | undefined;
  @property() target: string | undefined;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property() type: 'button' | 'submit' | 'reset' = 'button';
  /** Accessible name when the slot holds only an icon. */
  @property() label: string | undefined;

  override focus(options?: FocusOptions): void {
    this.renderRoot.querySelector<HTMLElement>('[part=control]')?.focus(options);
  }

  override render() {
    const cls = [
      'inline-flex items-center justify-center rounded-pill font-display font-semibold leading-none select-none',
      'transition-[transform,box-shadow,background-color] duration-token-fast ease-standard',
      'disabled:opacity-50 disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:pointer-events-none',
      variants[this.variant] ?? variants.primary,
      sizes[this.size] ?? sizes.md,
    ].join(' ');
    const content = html`<slot name="icon"></slot><slot></slot>`;
    if (this.href) {
      return html`<a
        part="control"
        class=${cls}
        href=${this.disabled ? nothing : this.href}
        target=${this.target ?? nothing}
        rel=${this.target === '_blank' ? 'noopener noreferrer' : nothing}
        aria-label=${this.label ?? nothing}
        aria-disabled=${this.disabled ? 'true' : nothing}
        >${content}</a
      >`;
    }
    return html`<button part="control" class=${cls} type=${this.type} ?disabled=${this.disabled} aria-label=${this.label ?? nothing}>
      ${content}
    </button>`;
  }
}
