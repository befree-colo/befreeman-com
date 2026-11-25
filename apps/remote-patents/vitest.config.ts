import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  // Resolve Svelte's browser build (mount/unmount) rather than its server build under jsdom.
  resolve: { conditions: ['browser'] },
  define: { __CONTENT_DIR__: JSON.stringify(fileURLToPath(new URL('../../libs/content/content', import.meta.url))) },
  test: { environment: 'jsdom', include: ['src/**/*.test.ts'], setupFiles: ['test/setup.ts'] },
});
