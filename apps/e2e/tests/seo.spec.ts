
import { expect, loadBundle, test } from './fixtures';

const bundle = loadBundle();

test.describe('crawlable without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('home contains the profile, roles, and achievement titles', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: bundle.profile.name })).toBeVisible();
    await expect(page.getByText(bundle.profile.valueStatement)).toBeVisible();
    for (const r of bundle.roles) await expect(page.getByRole('heading', { name: r.title })).toBeVisible();
    for (const a of bundle.achievements.filter((x) => x.featured)) await expect(page.getByRole('heading', { name: a.title })).toBeVisible();
  });

  test('every achievement page contains its title, summary, and impact statements', async ({ page }) => {
    for (const a of bundle.achievements) {
      const res = await page.goto(`/achievements/${a.id}`);
      expect(res?.status(), a.id).toBe(200);
      await expect(page.getByRole('heading', { level: 1, name: a.title })).toBeVisible();
      await expect(page.getByText(a.summary, { exact: true })).toBeVisible();
      for (const i of a.impact) await expect(page.getByText(i, { exact: true })).toBeVisible();
    }
  });

  test('timeline and skills pages carry their content', async ({ page }) => {
    await page.goto('/timeline');
    for (const r of bundle.roles) await expect(page.getByRole('heading', { name: r.title })).toBeVisible();
    await page.goto('/skills');
    for (const s of bundle.skills) await expect(page.getByText(s.name, { exact: true })).toBeVisible();
  });

  test('unknown URLs return a 404 page', async ({ page }) => {
    const res = await page.goto('/definitely/not/here');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  });

  test('home head has metadata and Person structured data', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://befreeman.com/');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://befreeman.com/og/home.png');
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}') as { name: string };
    expect(ld.name).toBe(bundle.profile.name);
  });
});

test.describe('discovery files', () => {
  test('sitemap, robots, and preview images are served', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text();
    for (const a of bundle.achievements) expect(sitemap).toContain(`/achievements/${a.id}</loc>`);
    expect(await (await request.get('/robots.txt')).text()).toContain('Sitemap: https://befreeman.com/sitemap.xml');
    const img = await request.get('/og/home.png');
    expect(img.status()).toBe(200);
    expect(img.headers()['content-type']).toBe('image/png');
  });
});

test.describe('progressive enhancement', () => {
  for (const path of ['/skills', '/timeline', `/achievements/${bundle.achievements[0]!.id}`]) {
    test(`remote takeover on ${path} keeps layout shift at or below 0.1`, async ({ page }) => {
      await page.addInitScript(() => {
        (window as unknown as { __cls: number }).__cls = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
            if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await page.goto(path);
      await expect(page.locator('[data-slot]').first()).toHaveAttribute('data-remote-state', 'mounted', { timeout: 15_000 });
      await page.waitForTimeout(1200); // let animations and late shifts settle
      const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
      expect(cls).toBeLessThanOrEqual(0.1);
    });
  }

  test('the live achievements remote shows the same facts as the pre-rendered page', async ({ page }) => {
    const a = bundle.achievements.find((x) => x.metrics?.length)!;
    await page.goto(`/achievements/${a.id}`);
    const live = page.locator('.bf-remote-host[data-remote="achievements"]');
    await expect(live.getByRole('heading', { level: 1 })).toHaveText(a.title);
    const staticText = await page.locator('[data-slot="achievements"] [data-prerendered]').evaluate((el) => el.textContent ?? '');
    for (const fact of [a.title, a.summary, ...a.impact, ...a.metrics!.map((m) => m.value)]) {
      expect(staticText).toContain(fact);
      await expect(live.getByText(fact, { exact: true }).first()).toBeVisible();
    }
  });
});
