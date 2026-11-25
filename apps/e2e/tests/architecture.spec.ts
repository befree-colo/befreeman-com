import { HOME_REMOTES } from '@befreeman/page-templates';
import { expect, test, waitForShell } from './fixtures';

interface Manifest {
  shell?: { version: string };
  remotes: Record<string, { version: string; framework: string }>;
}

async function scrollThroughSlots(page: import('@playwright/test').Page) {
  for (const slot of await page.locator('[data-slot]').all()) await slot.scrollIntoViewIfNeeded();
}

test.describe('architecture view', () => {
  test('outlines each remote and labels it with name, framework, and version from the manifest', async ({ page, request }) => {
    const manifest = (await (await request.get('/mfe-manifest.json')).json()) as Manifest;
    await page.goto('/');
    await waitForShell(page);
    const toggle = page.getByRole('button', { name: 'Architecture view' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.bf-arch-label').first()).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-arch', '');
    await scrollThroughSlots(page);

    for (const name of HOME_REMOTES) {
      const r = manifest.remotes[name]!;
      const slot = page.locator(`[data-slot="${name}"]`);
      await expect(slot).toHaveAttribute('data-remote-state', 'mounted');
      const label = slot.locator(':scope > .bf-arch-label');
      await expect(label).toBeVisible();
      await expect(label).toHaveText(`${name} · ${r.framework} · ${r.version}`);
      expect(await slot.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('dashed');
    }
    await expect(page.locator('[data-arch-shell]')).toHaveText(`shell · host · ${manifest.shell?.version ?? 'dev'}`);
    await expect(page.locator('[data-arch-shell]')).toBeVisible();

    await toggle.click();
    await expect(page.locator('.bf-arch-label').first()).toBeHidden();
  });

  test('labels the Svelte patents remote on its own page', async ({ page, request }) => {
    const manifest = (await (await request.get('/mfe-manifest.json')).json()) as Manifest;
    const r = manifest.remotes['patents']!;
    expect(r.framework).toBe('svelte');
    await page.goto('/patents');
    await waitForShell(page);
    await page.getByRole('button', { name: 'Architecture view' }).click();
    const slot = page.locator('[data-slot="patents"]');
    await expect(slot).toHaveAttribute('data-remote-state', 'mounted');
    await expect(slot.locator(':scope > .bf-arch-label')).toHaveText(`patents · svelte · ${r.version}`);
    expect(await slot.evaluate((el) => getComputedStyle(el).outlineColor)).toBe('rgb(255, 62, 0)');
  });

  test('labels a remote that failed to load as unavailable with the attempted version', async ({ page, request }) => {
    const manifest = (await (await request.get('/mfe-manifest.json')).json()) as Manifest;
    await page.route('**/remotes/timeline/**', (route) => route.abort());
    await page.goto('/');
    await waitForShell(page);
    await page.getByRole('button', { name: 'Architecture view' }).click();
    await scrollThroughSlots(page);
    const slot = page.locator('[data-slot="timeline"]');
    await expect(slot).toHaveAttribute('data-remote-state', 'failed');
    await expect(slot.locator(':scope > .bf-arch-label')).toHaveText(`timeline · unavailable · tried ${manifest.remotes['timeline']!.version}`);
    // the others are unaffected
    await expect(page.locator('[data-slot="skills"]')).toHaveAttribute('data-remote-state', 'mounted');
  });

  test('labels follow client-side navigation', async ({ page }) => {
    await page.goto('/');
    await waitForShell(page);
    await page.getByRole('button', { name: 'Architecture view' }).click();
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Skills' }).click();
    const label = page.locator('[data-slot="skills"] > .bf-arch-label');
    await expect(label).toHaveText(/^skills · react · /);
    await expect(label).not.toHaveText(/loading/);
  });
});
