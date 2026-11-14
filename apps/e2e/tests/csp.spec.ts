import { expect, test, waitForRemotes, waitForShell } from './fixtures';

declare global {
  interface Window {
    __violations: { directive: string; blocked: string }[];
    __pwned?: boolean;
  }
}

const recordViolations = () => {
  window.__violations = [];
  document.addEventListener('securitypolicyviolation', (e) =>
    window.__violations.push({ directive: e.effectiveDirective, blocked: e.blockedURI }),
  );
};

test.describe('content security policy', () => {
  test('pages are served with a strict script policy', async ({ request }) => {
    for (const path of ['/', '/achievements', '/timeline', '/skills', '/not-a-page']) {
      const res = await request.get(path);
      const csp = res.headers()['content-security-policy'] ?? '';
      const scriptSrc =
        csp
          .split(';')
          .map((d) => d.trim())
          .find((d) => d.startsWith('script-src')) ?? '';
      expect(scriptSrc, path).toBe("script-src 'self'");
      expect(csp, path).toContain("object-src 'none'");
      expect(csp, path).toContain("frame-ancestors 'none'");
    }
  });

  test('the composed site runs all three remotes without a single violation', async ({
    page,
    consoleErrors,
  }) => {
    await page.addInitScript(recordViolations);
    await page.goto('/');
    await waitForShell(page);
    await waitForRemotes(page);
    expect(await page.evaluate(() => window.__violations)).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('injected inline and third-party scripts are blocked', async ({ page }) => {
    await page.addInitScript(recordViolations);
    await page.goto('/');
    await waitForShell(page);
    page.on('console', () => undefined); // the browser logs the refusals; they are the expected outcome here
    await page.evaluate(() => {
      const inline = document.createElement('script');
      inline.textContent = 'window.__pwned = true';
      document.head.append(inline);
      const remote = document.createElement('script');
      remote.src = 'https://cdn.example.com/evil.js';
      document.head.append(remote);
    });
    await expect.poll(() => page.evaluate(() => window.__violations.length)).toBeGreaterThanOrEqual(2);
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
    const violations = await page.evaluate(() => window.__violations);
    expect(violations.map((v) => v.directive)).toEqual(expect.arrayContaining(['script-src-elem']));
    expect(violations.some((v) => v.blocked === 'inline')).toBe(true);
    expect(violations.some((v) => v.blocked.startsWith('https://cdn.example.com'))).toBe(true);
  });
});
