/**
 * `nx run ui-components:verify-artifact` — load the built ui.js into a blank page
 * (no bundler, no other code) and confirm every bf-* tag gets defined.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const TAGS = ['bf-button', 'bf-card', 'bf-chip', 'bf-dialog', 'bf-theme-toggle'];
const artifact = fileURLToPath(new URL('../../../../dist/libs/ui-components/ui.js', import.meta.url));
const code = await readFile(artifact, 'utf8');

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('https://ui.test/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/ui.js') return route.fulfill({ contentType: 'text/javascript', body: code });
    return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' });
  });
  await page.goto('https://ui.test/');
  await page.addScriptTag({ url: 'https://ui.test/ui.js', type: 'module' });
  const defined = await page.evaluate(async (tags) => {
    await Promise.race([
      Promise.all(tags.map((t) => customElements.whenDefined(t))),
      new Promise((r) => setTimeout(r, 5000)),
    ]);
    return tags.filter((t) => customElements.get(t));
  }, TAGS);
  const missing = TAGS.filter((t) => !defined.includes(t));
  if (missing.length || errors.length) {
    console.error(`✖ ui.js artifact check failed. Missing: ${missing.join(', ') || 'none'}. Errors: ${errors.join('; ') || 'none'}`);
    process.exitCode = 1;
  } else {
    console.log(`✔ ui.js (${(code.length / 1024).toFixed(1)} KiB) defines ${defined.join(', ')} in a blank page`);
  }
} finally {
  await browser.close();
}
