import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

/**
 * Standalone `ui` artifact: one ESM file with Lit and the compiled component sheet
 * embedded. Released like a remote and loaded once per page by the shell.
 */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [tailwindcss()],
  build: {
    outDir: fileURLToPath(new URL('../../dist/libs/ui-components', import.meta.url)),
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: true,
    lib: {
      entry: fileURLToPath(new URL('src/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'ui.js',
    },
    rolldownOptions: { output: { codeSplitting: false } },
  },
});
