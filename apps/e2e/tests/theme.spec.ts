import { expect, test, waitForShell } from './fixtures';

/** Record data-theme and body background at the first animation frame (i.e. before first paint). */
const recordFirstFrame = () => {
  requestAnimationFrame(() => {
    (window as unknown as Record<string, unknown>)['__firstFrame'] = {
      theme: document.documentElement.getAttribute('data-theme'),
    };
  });
};

const bodyBg = (page: import('@playwright/test').Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

const DARK_SURFACE = 'rgb(11, 13, 23)';
const LIGHT_SURFACE = 'rgb(247, 247, 251)';

test.describe('light and dark modes', () => {
  test('first visit follows a dark system preference, before first paint', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript(recordFirstFrame);
    await page.goto('/');
    await waitForShell(page);
    expect(await page.evaluate(() => (window as unknown as { __firstFrame: { theme: string } }).__firstFrame.theme)).toBe('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await bodyBg(page)).toBe(DARK_SURFACE);
  });

  test('first visit follows a light system preference', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await waitForShell(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await bodyBg(page)).toBe(LIGHT_SURFACE);
  });

  test('toggling switches mode without a reload and publishes theme:changed', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await waitForShell(page);
    await page.evaluate(() => {
      const w = window as unknown as { __events: unknown[]; __befreemanBus__: { target: EventTarget } };
      w.__events = [];
      w.__befreemanBus__.target.addEventListener('bf:theme:changed', (e) => w.__events.push((e as CustomEvent).detail.payload));
      (window as unknown as { __marker: boolean }).__marker = true; // survives only without reload
    });
    const toggle = page.getByRole('switch', { name: 'Dark mode' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(await bodyBg(page)).toBe(LIGHT_SURFACE);
    expect(await page.evaluate(() => (window as unknown as { __marker?: boolean }).__marker)).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { __events: unknown[] }).__events)).toEqual([{ theme: 'light' }]);
  });

  test('the choice persists across visits, overriding the system preference, with no flash', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await waitForShell(page);
    await page.getByRole('switch', { name: 'Dark mode' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.addInitScript(recordFirstFrame);
    await page.reload();
    await waitForShell(page);
    expect(await page.evaluate(() => (window as unknown as { __firstFrame: { theme: string } }).__firstFrame.theme)).toBe('light');
    await expect(page.getByRole('switch', { name: 'Dark mode' })).toHaveAttribute('aria-checked', 'false');
    expect(await page.evaluate(() => localStorage.getItem('bf-theme'))).toBe('light');
  });

  test('keyboard users can toggle the mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await waitForShell(page);
    await page.getByRole('switch', { name: 'Dark mode' }).focus();
    await page.keyboard.press('Space');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('still works when storage is unavailable (falls back to system, no errors)', async ({ page, consoleErrors }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('blocked');
        },
      });
    });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await waitForShell(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('switch', { name: 'Dark mode' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(consoleErrors).toEqual([]);
  });
});
