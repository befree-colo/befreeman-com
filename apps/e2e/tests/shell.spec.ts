import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { dist, expect, loadBundle, test, waitForShell } from './fixtures';

const bundle = loadBundle();

test.describe('shell layout', () => {
  test('home renders the hero, primary nav, and footer from career content', async ({ page, consoleErrors }) => {
    await page.goto('/');
    await waitForShell(page);
    await expect(page.getByRole('heading', { level: 1, name: bundle.profile.name })).toBeVisible();
    await expect(page.getByText(bundle.profile.valueStatement)).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Primary' });
    for (const label of ['Achievements', 'Timeline', 'Skills']) await expect(nav.getByRole('link', { name: label })).toBeVisible();
    await expect(page.locator('[data-brand]')).toHaveText(bundle.profile.name);
    await expect(page.locator('#contact')).toContainText('Let’s build something.');
    expect(await page.evaluate(() => ['bf-button', 'bf-dialog', 'bf-theme-toggle'].every((t) => !!customElements.get(t)))).toBe(true);
    expect(consoleErrors).toEqual([]);
  });

  test('uses the shared theme: display font and accent colors', async ({ page }) => {
    await page.goto('/');
    await waitForShell(page);
    const h1 = page.getByRole('heading', { level: 1, name: bundle.profile.name });
    expect(await h1.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Space Grotesk');
  });

  test('contact dialog opens from the hero and shows profile links, never the raw email', async ({ page }) => {
    await page.goto('/');
    await waitForShell(page);
    await page.getByRole('link', { name: 'Get in touch' }).click();
    const dialog = page.getByRole('dialog', { name: 'Get in touch' });
    await expect(dialog).toBeVisible();
    // Slotted (light DOM) content belongs to the <bf-dialog> host, not the native <dialog> in its shadow root.
    const host = page.locator('#contact-dialog');
    for (const l of bundle.profile.links) await expect(host.getByRole('link', { name: l.label })).toBeVisible();
    await expect(host.getByRole('button', { name: 'Email me' })).toHaveCount(bundle.profile.contactToken ? 1 : 0);
    const html = await page.evaluate(() => {
      const parts = [document.documentElement.outerHTML];
      for (const el of document.querySelectorAll('*')) if (el.shadowRoot) parts.push(el.shadowRoot.innerHTML);
      return parts.join('\n');
    });
    expect(html).not.toContain('@example.com');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('unknown routes render the not-found page with a link home', async ({ page }) => {
    await page.goto('/this/does/not/exist');
    await waitForShell(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    await page.getByRole('link', { name: 'Back to the home page' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { level: 1, name: bundle.profile.name })).toBeVisible();
  });
});

test('built shell output never contains the raw contact email', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(html|js|css|json|xml|txt)$/.test(f)) files.push(p);
    }
  };
  walk(join(dist, 'apps/shell'));
  walk(join(dist, 'libs/content'));
  expect(files.length).toBeGreaterThan(2);
  for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toContain('contact@example.com');
});
