import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  plugins: [tailwindcss()],
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'node', environment: 'node', include: ['scripts/**/*.test.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
            screenshotFailures: false,
          },
        },
      },
    ],
  },
});
