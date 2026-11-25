import AxeBuilder from '@axe-core/playwright';
import { expect, loadBundle, test, waitForShell } from './fixtures';

const bundle = loadBundle();
const PAGES = ['/', '/achievements', `/achievements/${bundle.achievements[0]!.id}`, '/timeline', '/skills', '/patents', '/not-a-page'];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function settle(page: import('@playwright/test').Page) {
  await waitForShell(page);
  for (const slot of await page.locator('[data-slot]').all()) {
    await slot.scrollIntoViewIfNeeded();
    await expect(slot).toHaveAttribute('data-remote-state', /mounted|failed/, { timeout: 15_000 });
  }
  // Let entrance animations finish so contrast is measured on final colors.
  await page.evaluate(async () => {
    const roots: (Document | ShadowRoot)[] = [document];
    for (const el of document.querySelectorAll('*')) if (el.shadowRoot) roots.push(el.shadowRoot);
    await Promise.all(roots.flatMap((r) => r.getAnimations()).filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)));
  });
}

const summarize = (violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']) =>
  violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n    ')}`);

for (const mode of ['light', 'dark'] as const) {
  test.describe(`WCAG 2.2 AA in ${mode} mode`, () => {
    test.use({ colorScheme: mode });
    for (const path of PAGES) {
      test(`${path} has no axe violations`, async ({ page }) => {
        await page.goto(path);
        await settle(page);
        const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        expect(summarize(results.violations)).toEqual([]);
      });
    }

    test('the open contact dialog has no axe violations', async ({ page }) => {
      await page.goto('/');
      await settle(page);
      await page.getByRole('link', { name: 'Get in touch' }).click();
      await expect(page.getByRole('dialog', { name: 'Get in touch' })).toBeVisible();
      await page.waitForTimeout(600);
      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      expect(summarize(results.violations)).toEqual([]);
    });

    test('the architecture view has no axe violations', async ({ page }) => {
      await page.goto('/');
      await settle(page);
      await page.getByRole('button', { name: 'Architecture view' }).click();
      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      expect(summarize(results.violations)).toEqual([]);
    });
  });
}

test('canary: the audit fails when a violation is introduced', async ({ page }) => {
  await page.goto('/');
  await settle(page);
  await page.evaluate(() => {
    const img = document.createElement('img'); // no alt text
    img.src = '/favicon.svg';
    const low = document.createElement('p'); // fails contrast in both modes
    low.textContent = 'low contrast';
    low.style.color = '#999';
    low.style.background = '#aaa';
    document.querySelector('main')?.append(img, low);
  });
  const ids = (await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations.map((v) => v.id);
  expect(ids).toEqual(expect.arrayContaining(['image-alt', 'color-contrast']));
});
