import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { BfElement } from '../base';

export type ThemeMode = 'light' | 'dark';

export interface ThemeChangeDetail {
  theme: ThemeMode;
}

/**
 * @tagname bf-theme-toggle
 * Light/dark switch. It only reports the choice (`bf-theme-change`); the shell
 * owns applying and persisting the mode.
 * @fires bf-theme-change - CustomEvent<ThemeChangeDetail>
 * @csspart control - the switch button
 */
export class BfThemeToggle extends BfElement {
  @property({ reflect: true }) theme: ThemeMode = 'light';
  @property() label = 'Dark mode';

  private toggle() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    this.dispatchEvent(
      new CustomEvent<ThemeChangeDetail>('bf-theme-change', {
        detail: { theme: this.theme },
        bubbles: true,
        composed: true,
      }),
    );
  }

  override render() {
    const dark = this.theme === 'dark';
    return html`<button
      part="control"
      type="button"
      role="switch"
      aria-checked=${dark ? 'true' : 'false'}
      aria-label=${this.label}
      class="group inline-flex h-9 w-16 items-center rounded-pill bg-surface-sunken p-1 ring-1 ring-border transition-colors duration-token-base ease-standard hover:ring-accent"
      @click=${this.toggle}
    >
      <span
        class="grid size-7 place-items-center rounded-pill bg-accent text-accent-ink shadow-md transition-transform duration-token-base ease-emphasized ${dark
          ? 'translate-x-7'
          : 'translate-x-0'}"
      >
        ${dark
          ? html`<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>`
          : html`<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>`}
      </span>
    </button>`;
  }
}
