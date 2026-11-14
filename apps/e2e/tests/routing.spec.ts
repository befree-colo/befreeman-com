import { expect, loadBundle, test, waitForShell } from './fixtures';

const bundle = loadBundle();
const achievement = bundle.achievements.find((a) => a.caseStudy) ?? bundle.achievements[0]!;

/** Pre-create the page bus so we can record every event the shell publishes from the start. */
const recordBus = () => {
  const target = new EventTarget();
  const w = window as unknown as { __befreemanBus__: unknown; __events: { name: string; payload: unknown }[] };
  w.__events = [];
  w.__befreemanBus__ = { target, diagnostics: true };
  for (const name of ['route:changed', 'remote:error', 'nav:request']) {
    target.addEventListener(`bf:${name}`, (e) => w.__events.push({ name, payload: (e as CustomEvent).detail.payload }));
  }
};
const events = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { __events: { name: string; payload: unknown }[] }).__events);

test.describe('shell routing', () => {
  test('deep link to an achievement hands the sub-path to the achievements remote', async ({ page, consoleErrors }) => {
    await page.addInitScript(recordBus);
    await page.goto(`/achievements/${achievement.id}`);
    await waitForShell(page);
    // The shell rendered the matching static detail (hidden once the live remote takes over).
    await expect(page.locator('[data-slot="achievements"] [data-prerendered] h1')).toHaveText(achievement.title);
    await expect(page.locator('[data-slot="achievements"]')).toHaveAttribute('data-remote-state', 'mounted');
    await expect(page.locator('[data-slot]')).toHaveCount(1);
    expect(await events(page)).toContainEqual({
      name: 'route:changed',
      payload: { path: `/achievements/${achievement.id}`, subPath: achievement.id, owner: 'achievements' },
    });
    expect(consoleErrors).toEqual([]);
  });

  test('no remote mounts before the shared ui components are defined', async ({ page }) => {
    await page.route('**/ui/**', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto('/skills');
    const samples: { defined: boolean; hosts: number }[] = [];
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      samples.push(
        await page.evaluate(() => ({
          defined: !!customElements.get('bf-button'),
          hosts: document.querySelectorAll('.bf-remote-host').length,
        })),
      );
      if (samples.at(-1)!.hosts > 0) break;
      await page.waitForTimeout(100);
    }
    expect(samples.some((s) => !s.defined)).toBe(true); // we really observed the gap
    expect(samples.every((s) => s.defined || s.hosts === 0)).toBe(true);
    await expect(page.locator('[data-slot="skills"]')).toHaveAttribute('data-remote-state', 'mounted');
  });

  test('client-side navigation re-renders the view and publishes route:changed', async ({ page }) => {
    await page.addInitScript(recordBus);
    await page.goto('/');
    await waitForShell(page);
    const before = await page.evaluate(() => performance.getEntriesByType('navigation').length);
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Timeline' }).click();
    await expect(page).toHaveURL('/timeline');
    await expect(page.getByRole('heading', { level: 1, name: 'Timeline' })).toBeVisible();
    await expect(page).toHaveTitle(/Career timeline/);
    await expect(page.locator('[data-slot="timeline"]')).toHaveAttribute('data-remote-state', 'mounted');
    expect(await page.evaluate(() => performance.getEntriesByType('navigation').length)).toBe(before); // no reload
    expect(await events(page)).toContainEqual({ name: 'route:changed', payload: { path: '/timeline', subPath: '', owner: 'timeline' } });

    await page.goBack();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { level: 1, name: bundle.profile.name })).toBeVisible();
  });

  test('a remote can request navigation through the bus; the shell performs it', async ({ page }) => {
    await page.goto('/');
    await waitForShell(page);
    await page.evaluate(() => {
      const t = (window as unknown as { __befreemanBus__: { target: EventTarget } }).__befreemanBus__.target;
      t.dispatchEvent(new CustomEvent('bf:nav:request', { detail: { v: 1, name: 'nav:request', payload: { path: '/skills' } } }));
    });
    await expect(page).toHaveURL('/skills');
    await expect(page.locator('[data-slot="skills"]')).toHaveAttribute('data-remote-state', 'mounted');
  });
});

test.describe('achievements remote (Angular) in the composed site', () => {
  test('a deep link renders the achievement in the live remote, styled inside its shadow root', async ({ page, consoleErrors }) => {
    await page.goto(`/achievements/${achievement.id}`);
    await waitForShell(page);
    const live = page.locator('.bf-remote-host[data-remote="achievements"]');
    await expect(live.getByRole('heading', { level: 1, name: achievement.title })).toBeVisible();
    await expect(live.getByTestId('impact')).toContainText(achievement.impact[0]!);
    // Tailwind utility from the adopted sheet applies inside the shadow root.
    const h1Font = await live.getByRole('heading', { level: 1 }).evaluate((el) => getComputedStyle(el).fontFamily);
    expect(h1Font).toContain('Space Grotesk');
    expect(consoleErrors).toEqual([]);
  });

  test('technology filters update the list and the URL without a reload', async ({ page }) => {
    await page.goto('/achievements');
    await waitForShell(page);
    const live = page.locator('.bf-remote-host[data-remote="achievements"]');
    const tech = bundle.skills.find((s) => s.id === bundle.achievements[0]!.skills[0])!;
    const chip = live.getByRole('button', { name: tech.name, exact: true });
    await chip.click();
    await expect(page).toHaveURL(`/achievements?tech=${tech.id}`);
    const count = bundle.achievements.filter((a) => a.skills.includes(tech.id)).length;
    await expect(live.getByTestId('result-count')).toHaveText(`Showing ${count} of ${bundle.achievements.length} achievements`);
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
  });
});
