import { compile } from 'tailwindcss';

/**
 * Utilities whose implementation relies on registered custom properties (`@property`).
 * `@property` is ignored inside shadow roots, so the shell registers these once at
 * document level (document.css) and every remote's utilities work inside its shadow root.
 */
export const PROPERTY_PROBE_CLASSES = [
  'shadow-md',
  'inset-shadow-sm',
  'ring-2',
  'inset-ring-2',
  'ring-offset-2',
  'translate-x-1',
  'translate-y-1',
  'translate-z-1',
  'rotate-3',
  'rotate-x-3',
  'rotate-y-3',
  'skew-x-3',
  'scale-105',
  'scale-x-105',
  'bg-linear-to-r',
  'from-accent',
  'via-accent-2',
  'to-accent',
  'blur-sm',
  'brightness-110',
  'drop-shadow-md',
  'backdrop-blur-sm',
  'border-solid',
  'border-dashed',
  'outline-solid',
  'space-x-2',
  'divide-x',
  'tabular-nums',
  'tracking-tight',
  'leading-tight',
  'font-bold',
  'duration-200',
  'ease-standard',
  'content-none',
  'mask-linear-from-50%',
  'text-shadow-sm',
];

/** Compile the probe utilities with the shared theme and return their `@property` rules. */
export async function propertyRegistrations(theme: string): Promise<string> {
  const input = `@import 'tailwindcss/theme.css' layer(theme);\n@import 'tailwindcss/utilities.css' layer(utilities);\n${theme}`;
  const compiler = await compile(input, {
    base: process.cwd(),
    loadStylesheet: async (id: string, base: string) => {
      const { createRequire } = await import('node:module');
      const { readFile } = await import('node:fs/promises');
      const { dirname } = await import('node:path');
      const require = createRequire(base + '/');
      const path = require.resolve(id.startsWith('tailwindcss/') ? id : id);
      return { path, base: dirname(path), content: await readFile(path, 'utf8') };
    },
  });
  const css = compiler.build(PROPERTY_PROBE_CLASSES);
  const rules = [...css.matchAll(/@property\s+(--[\w-]+)\s*\{[^}]*\}/g)];
  const unique = new Map<string, string>();
  for (const m of rules) unique.set(m[1] ?? '', m[0].replace(/\s+/g, ' ').replace('{ ', '{\n  ').replace(/; /g, ';\n  ').replace(/;?\s*\}$/, ';\n}'));
  return [...unique.values()].sort().join('\n');
}
