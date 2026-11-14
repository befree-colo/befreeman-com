import { defineOnce } from './define';
import { BfButton } from './components/button';
import { BfCard } from './components/card';
import { BfChip } from './components/chip';
import { BfDialog } from './components/dialog';
import { BfThemeToggle } from './components/theme-toggle';

export const TAGS = ['bf-button', 'bf-card', 'bf-chip', 'bf-dialog', 'bf-theme-toggle'] as const;
export type BfTag = (typeof TAGS)[number];

export function registerAll(): void {
  defineOnce('bf-button', BfButton);
  defineOnce('bf-card', BfCard);
  defineOnce('bf-chip', BfChip);
  defineOnce('bf-dialog', BfDialog);
  defineOnce('bf-theme-toggle', BfThemeToggle);
}

/** Resolves when every bf-* tag is defined (used by the shell before mounting remotes). */
export function whenAllDefined(): Promise<void> {
  return Promise.all(TAGS.map((t) => customElements.whenDefined(t))).then(() => undefined);
}
