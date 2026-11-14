import { expect, loadBundle, test, waitForRemotes, waitForShell } from './fixtures';

const bundle = loadBundle();
const WIDTH = 375;

test.use({ viewport: { width: WIDTH, height: 812 }, isMobile: true, hasTouch: true });

const pageWidth = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth);

test.describe('phone-width viewport (375px)', () => {
  for (const path of [
    '/',
    '/achievements',
    `/achievements/${bundle.achievements[0]!.id}`,
    '/timeline',
    '/skills',
    '/not-a-page',
  ]) {
    test(`${path} has no horizontal page scroll`, async ({ page, consoleErrors }) => {
      await page.goto(path);
      await waitForShell(page);
      await waitForRemotes(page);
      expect(await pageWidth(page)).toBeLessThanOrEqual(WIDTH);
      for (const link of await page.getByRole('navigation', { name: 'Primary' }).getByRole('link').all()) {
        const box = (await link.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(WIDTH);
      }
      // The not-found page is served with a 404 status, which the browser logs as a failed resource.
      expect(consoleErrors.filter((e) => !(path === '/not-a-page' && e.includes('404')))).toEqual([]);
    });
  }

  test('achievement cards reflow to a single column', async ({ page }) => {
    await page.goto('/achievements');
    await waitForShell(page);
    await waitForRemotes(page);
    const cards = page.locator('.bf-remote-host[data-remote="achievements"] bf-card');
    const boxes = await Promise.all((await cards.all()).map((c) => c.boundingBox()));
    expect(boxes.length).toBeGreaterThan(1);
    const xs = new Set(boxes.map((b) => Math.round(b!.x)));
    expect(xs.size).toBe(1);
  });

  test('controls stay operable: theme toggle, filters, timeline, and radar', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/achievements');
    await waitForShell(page);
    await waitForRemotes(page);
    await page.getByRole('switch', { name: 'Dark mode' }).tap();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    const skill = bundle.skills.find((s) => bundle.achievements.some((a) => a.skills.includes(s.id)))!;
    const live = page.locator('.bf-remote-host[data-remote="achievements"]');
    await live.getByRole('button', { name: skill.name, exact: true }).tap();
    await expect(page).toHaveURL(new RegExp(`tech=${skill.id}`));
    expect(await pageWidth(page)).toBeLessThanOrEqual(WIDTH);

    await page.goto('/timeline');
    await waitForShell(page);
    await waitForRemotes(page);
    const role = bundle.roles[0]!;
    const item = page.locator(`.bf-remote-host[data-remote="timeline"] li[data-entity-id="${role.id}"]`);
    await item.getByTestId('expand').tap();
    await expect(item.getByTestId('panel')).toBeVisible();
    expect(await pageWidth(page)).toBeLessThanOrEqual(WIDTH);

    await page.goto('/skills');
    await waitForShell(page);
    await waitForRemotes(page);
    await page
      .locator('.bf-remote-host[data-remote="skills"]')
      .locator(`button[data-skill="${skill.id}"]`)
      .tap();
    await expect(page.getByTestId('skill-detail')).toContainText(skill.name);
    expect(await pageWidth(page)).toBeLessThanOrEqual(WIDTH);
  });
});
