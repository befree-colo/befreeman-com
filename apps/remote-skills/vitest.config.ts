import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [tailwindcss()],
  esbuild: { jsx: 'automatic' },
  define: { __CONTENT_DIR__: JSON.stringify(fileURLToPath(new URL('../../libs/content/content', import.meta.url))) },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'], setupFiles: ['test/setup.ts'] },
});
