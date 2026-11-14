import type { EventBus, Theme } from '@befreeman/mfe-contract';

export const THEME_STORAGE_KEY = 'bf-theme';
const QUERY = '(prefers-color-scheme: dark)';

function readStored(storage: Storage | undefined): Theme | null {
  try {
    const v = storage?.getItem(THEME_STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function systemTheme(win: Window): Theme {
  return win.matchMedia?.(QUERY).matches ? 'dark' : 'light';
}

export interface ThemeController {
  readonly current: Theme;
  set(theme: Theme, opts?: { persist?: boolean }): void;
  dispose(): void;
}

/**
 * The shell owns the mode. `theme-init.js` already set `data-theme` before first
 * paint; this keeps toggles, storage, the system preference, and the bus in sync.
 */
export function createThemeController(bus: EventBus, win: Window = window): ThemeController {
  const doc = win.document;
  const storage = (() => {
    try {
      return win.localStorage;
    } catch {
      return undefined;
    }
  })();
  const attr = doc.documentElement.getAttribute('data-theme');
  let current: Theme = attr === 'dark' || attr === 'light' ? attr : (readStored(storage) ?? systemTheme(win));

  const syncToggles = () => {
    for (const t of doc.querySelectorAll('bf-theme-toggle')) (t as HTMLElement & { theme: Theme }).theme = current;
  };

  const apply = (theme: Theme, persist: boolean) => {
    const changed = theme !== current || doc.documentElement.getAttribute('data-theme') !== theme;
    current = theme;
    doc.documentElement.setAttribute('data-theme', theme);
    if (persist) {
      try {
        storage?.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        /* storage unavailable: the choice lasts for this page only */
      }
    }
    syncToggles();
    if (changed) bus.publish('theme:changed', { theme });
  };

  const onToggle = (e: Event) => {
    const theme = (e as CustomEvent<{ theme: Theme }>).detail?.theme;
    if (theme === 'light' || theme === 'dark') apply(theme, true);
  };
  doc.addEventListener('bf-theme-change', onToggle);

  const mql = win.matchMedia?.(QUERY);
  const onSystem = (e: MediaQueryListEvent) => {
    if (!readStored(storage)) apply(e.matches ? 'dark' : 'light', false);
  };
  mql?.addEventListener('change', onSystem);

  apply(current, false);
  // Toggles upgraded later (ui artifact loads async) pick up the current mode.
  void win.customElements?.whenDefined('bf-theme-toggle').then(syncToggles);

  return {
    get current() {
      return current;
    },
    set: (theme, opts) => apply(theme, opts?.persist ?? true),
    dispose() {
      doc.removeEventListener('bf-theme-change', onToggle);
      mql?.removeEventListener('change', onSystem);
    },
  };
}
