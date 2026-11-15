// Lighthouse CI against the local compose server (no Cloudflare needed).
// Budgets: CLS <= 0.1 everywhere; script/stylesheet transfer per remote page.
// Remotes compile their CSS into JS (adopted shadow-root sheets), so each remote's
// CSS weight counts in its script budget; tests/budgets.spec.ts checks the CSS itself.
const { chromium } = require('@playwright/test');
const budgets = require('./budgets.json');

const port = process.env.LHCI_PORT ?? '4310';
const base = `http://localhost:${port}`;
const achievement = process.env.LHCI_ACHIEVEMENT ?? 'first-contentful-paint';

const pageBudget = (b) => ({
  'resource-summary:script:size': ['error', { maxNumericValue: b.scriptBytes }],
  'resource-summary:stylesheet:size': ['error', { maxNumericValue: b.stylesheetBytes }],
});

module.exports = {
  ci: {
    collect: {
      startServerCommand: `env PORT=${port} pnpm exec tsx src/compose-server.ts`,
      startServerReadyPattern: 'composed site on',
      url: ['/', '/achievements', `/achievements/${achievement}`, '/timeline', '/skills'].map(
        (p) => base + p,
      ),
      numberOfRuns: 1,
      chromePath: chromium.executablePath(),
      settings: {
        preset: 'desktop',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        chromeFlags: '--headless=new --no-sandbox --disable-dev-shm-usage',
      },
    },
    assert: {
      assertMatrix: [
        {
          matchingUrlPattern: '.*',
          assertions: { 'cumulative-layout-shift': ['error', { maxNumericValue: budgets.cls }] },
        },
        { matchingUrlPattern: `${base}/$`, assertions: pageBudget(budgets.pages.home) },
        {
          matchingUrlPattern: `${base}/achievements(/.*)?$`,
          assertions: pageBudget(budgets.pages.achievements),
        },
        { matchingUrlPattern: `${base}/timeline$`, assertions: pageBudget(budgets.pages.timeline) },
        { matchingUrlPattern: `${base}/skills$`, assertions: pageBudget(budgets.pages.skills) },
      ],
    },
    upload: { target: 'filesystem', outputDir: '../../tmp/lhci' },
  },
};
