import { readFileSync } from 'node:fs';
import { expect, test, waitForRemotes, waitForShell } from './fixtures';

/**
 * Per-remote CSS budgets. Remotes compile their Tailwind CSS into JS and adopt it into their
 * shadow root, so Lighthouse sees it only as script bytes; this measures the CSS itself.
 * Budgets live in budgets.json next to the Lighthouse CI config.
 */
const budgets = JSON.parse(readFileSync(new URL('../budgets.json', import.meta.url), 'utf8')) as {
  remoteCssBytes: Record<'achievements' | 'timeline' | 'skills', number>;
};

for (const [remote, max] of Object.entries(budgets.remoteCssBytes)) {
  test(`${remote} remote CSS stays within ${max} bytes`, async ({ page }, info) => {
    await page.goto(`/${remote}`);
    await waitForShell(page);
    await waitForRemotes(page);
    const bytes = await page.locator(`.bf-remote-host[data-remote="${remote}"]`).evaluate((host) => {
      const sheets = host.shadowRoot?.adoptedStyleSheets ?? [];
      return sheets.reduce(
        (n, s) => n + [...s.cssRules].reduce((m, r) => m + new TextEncoder().encode(r.cssText).length, 0),
        0,
      );
    });
    info.annotations.push({ type: 'css-bytes', description: String(bytes) });
    expect(bytes).toBeGreaterThan(0);
    expect(bytes).toBeLessThanOrEqual(max);
  });
}
