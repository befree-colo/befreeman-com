import { html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { BfElement } from '../base';

export type CardVariant = 'raised' | 'outline' | 'glow';

const variants: Record<CardVariant, string> = {
  raised: 'bg-surface-raised shadow-md',
  outline: 'bg-surface ring-1 ring-border',
  glow: 'bg-surface-raised shadow-glow',
};

/**
 * @tagname bf-card
 * Content container.
 * @slot heading - title area
 * @slot - body
 * @slot footer - actions or metadata
 * @csspart card - the outer element
 */
export class BfCard extends BfElement {
  @property({ reflect: true }) variant: CardVariant = 'raised';
  /** Makes the whole card a link. */
  @property() href: string | undefined;
  /** Visual highlight, e.g. when an `entity:focus` event targets this card. */
  @property({ type: Boolean, reflect: true }) highlighted = false;

  override render() {
    const cls = [
      'block rounded-lg p-6 text-ink no-underline transition-[box-shadow,transform,outline-color] duration-token-base ease-standard',
      variants[this.variant] ?? variants.raised,
      this.href ? 'hover:-translate-y-1 hover:shadow-lg cursor-pointer' : '',
      this.highlighted ? 'outline-3 outline-solid outline-accent-2 outline-offset-4' : '',
    ].join(' ');
    const body = html`
      <div class="font-display text-xl font-bold mb-2"><slot name="heading"></slot></div>
      <div class="text-ink-muted"><slot></slot></div>
      <div class="mt-4 empty:hidden"><slot name="footer"></slot></div>
    `;
    return this.href
      ? html`<a part="card" class=${cls} href=${this.href}>${body}</a>`
      : html`<article part="card" class=${cls} data-highlighted=${this.highlighted ? 'true' : nothing}>${body}</article>`;
  }
}
