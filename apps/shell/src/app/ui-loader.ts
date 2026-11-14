import { withTimeout } from './timeout';

export const UI_TAGS = ['bf-button', 'bf-card', 'bf-chip', 'bf-dialog', 'bf-theme-toggle'] as const;

/**
 * Load the shared component library once (it registers every bf-* tag) and resolve
 * when all tags are defined. Remotes are mounted only after this resolves.
 */
export async function loadUi(entry: string, timeoutMs: number, importer: (url: string) => Promise<unknown> = (url) => import(/* webpackIgnore: true */ url)): Promise<void> {
  await withTimeout(
    (async () => {
      await importer(entry);
      await Promise.all(UI_TAGS.map((t) => customElements.whenDefined(t)));
    })(),
    timeoutMs,
    'ui components',
  );
}
