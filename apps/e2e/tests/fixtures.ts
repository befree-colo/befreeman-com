import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test as base, expect } from '@playwright/test';
import type { CareerContentBundle } from '@befreeman/content';

const dist = fileURLToPath(new URL('../../../dist/', import.meta.url));

export function loadBundle(): CareerContentBundle {
  const latest = JSON.parse(readFileSync(`${dist}libs/content/content.latest.json`, 'utf8')) as { file: string };
  return JSON.parse(readFileSync(`${dist}libs/content/${latest.file}`, 'utf8')) as CareerContentBundle;
}

/** Collects console errors and page errors; tests assert it stays empty. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));
    await use(errors);
  },
});

export async function waitForShell(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-shell-ready', 'true', { timeout: 15_000 });
}

export { expect, dist };
