/**
 * Runtime entry. Loaded once per page by the shell (as the `ui` artifact).
 * Remotes must not import this; they import types from `@befreeman/ui-components/types`.
 */
import { registerAll } from './register';

registerAll();

export { registerAll, whenAllDefined, TAGS } from './register';
export { defineOnce } from './define';
export { BfButton } from './components/button';
export { BfCard } from './components/card';
export { BfChip } from './components/chip';
export { BfDialog } from './components/dialog';
export { BfThemeToggle } from './components/theme-toggle';
