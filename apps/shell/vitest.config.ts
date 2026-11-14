import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __BF_PRODUCTION__: 'false' },
  test: { environment: 'jsdom', include: ['src/**/*.test.ts'] },
});
