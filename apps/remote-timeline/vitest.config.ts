import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [vue({ template: { compilerOptions: { isCustomElement: (t) => t.startsWith('bf-') } } }), tailwindcss()],
  define: { __CONTENT_DIR__: JSON.stringify(fileURLToPath(new URL('../../libs/content/content', import.meta.url))) },
  test: { environment: 'jsdom', include: ['src/**/*.test.ts'], setupFiles: ['test/setup.ts'] },
});
