import { chromium } from '@playwright/test';
import { signPreview } from '@befreeman/mfe-contract/preview';
import { REMOTE_REGISTRY, isRegisteredRemote } from '@befreeman/mfe-contract/registry';
import type { SmokeCheck } from './release';

/**
 * Pre-promotion smoke check against a deployed site (staging or `wrangler dev`):
 * load each affected remote's page with a signed preview override, and require
 * that the override applied, the remote mounted, and nothing logged an error.
 */
export function playwrightSmoke(baseUrl: string, secret: string, timeoutMs = 20_000): SmokeCheck {
  return async (overrides, remotes) => {
    const query = new URLSearchParams(await signPreview(overrides, secret, 900)).toString();
    const failures: string[] = [];
    const browser = await chromium.launch();
    try {
      for (const name of remotes) {
        if (!isRegisteredRemote(name)) {
          failures.push(`${name}: not a registered remote`);
          continue;
        }
        const context = await browser.newContext();
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
        page.on('pageerror', (e) => errors.push(String(e)));
        try {
          await page.goto(`${baseUrl}${REMOTE_REGISTRY[name].page}?${query}`, { waitUntil: 'domcontentloaded' });
          const preview = await page.evaluate(async () => (await fetch('/mfe-manifest.json', { cache: 'no-store' })).headers.get('x-bf-preview'));
          if (preview !== 'applied') failures.push(`${name}: preview override not applied (${preview ?? 'no header'})`);
          const slot = page.locator(`[data-slot="${name}"]`);
          await slot.waitFor({ timeout: timeoutMs });
          await page.waitForFunction(
            (n) => ['mounted', 'failed'].includes(document.querySelector(`[data-slot="${n}"]`)?.getAttribute('data-remote-state') ?? ''),
            name,
            { timeout: timeoutMs },
          );
          const state = await slot.getAttribute('data-remote-state');
          if (state !== 'mounted') failures.push(`${name}: remote state is "${state}"`);
          for (const e of errors) failures.push(`${name}: console error: ${e}`);
        } catch (error) {
          failures.push(`${name}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
        } finally {
          await context.close();
        }
      }
    } finally {
      await browser.close();
    }
    return failures;
  };
}
