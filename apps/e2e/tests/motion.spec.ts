import { expect, loadBundle, test, waitForRemotes, waitForShell } from './fixtures';

const bundle = loadBundle();

declare global {
  interface Window {
    __animateCalls: number;
  }
}

/** Count script-driven animations (Element.animate) that actually move or fade over time. */
const countAnimateCalls = () => {
  window.__animateCalls = 0;
  const original = Element.prototype.animate;
  Element.prototype.animate = function (this: Element, ...args: Parameters<Element['animate']>) {
    const opts = args[1];
    const duration = typeof opts === 'number' ? opts : Number(opts?.duration ?? 0);
    if (duration > 0) window.__animateCalls++;
    return original.apply(this, args);
  };
};

/** CSS animation names applied to the shared "rise" entrance effect, across every shadow root. */
const riseAnimations = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    const visit = (root: Document | ShadowRoot) => {
      for (const el of root.querySelectorAll('*')) {
        if (el.getAttribute('class')?.includes('animate-rise')) out.push(getComputedStyle(el).animationName);
        if (el.shadowRoot) visit(el.shadowRoot);
      }
    };
    visit(document);
    return out;
  });

/** Running animations with a real duration, including those inside shadow roots. */
const runningAnimations = (page: import('@playwright/test').Page) =>
  page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.playState === 'running' && Number(a.effect?.getComputedTiming().duration ?? 0) > 0)
      .map((a) => (a as CSSAnimation).animationName ?? 'script'),
  );

async function expandFirstRole(page: import('@playwright/test').Page) {
  const role = bundle.roles[0]!;
  const item = page.locator(`.bf-remote-host[data-remote="timeline"] li[data-entity-id="${role.id}"]`);
  await item.getByTestId('expand').click();
  await expect(item.getByTestId('panel')).toBeVisible();
  await expect(item.getByText(role.responsibilities[0]!)).toBeVisible();
}

test.describe('reduced motion', () => {
  test('with no preference, entrance and expand animations play (control)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(countAnimateCalls);
    await page.goto('/timeline');
    await waitForShell(page);
    await waitForRemotes(page);
    expect((await riseAnimations(page)).filter((n) => n !== 'none').length).toBeGreaterThan(0);
    await expandFirstRole(page);
    expect(await page.evaluate(() => window.__animateCalls)).toBeGreaterThan(0);
  });

  for (const path of ['/', '/timeline', '/skills', `/achievements/${bundle.achievements[0]!.id}`]) {
    test(`${path}: nothing animates and all content stays reachable`, async ({ page, consoleErrors }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(countAnimateCalls);
      await page.goto(path);
      await waitForShell(page);
      await waitForRemotes(page);
      expect((await riseAnimations(page)).filter((n) => n !== 'none')).toEqual([]);
      expect(await runningAnimations(page)).toEqual([]);
      if (path === '/timeline') await expandFirstRole(page);
      if (path === '/skills') {
        const skill = bundle.skills[0]!;
        await page
          .locator('.bf-remote-host[data-remote="skills"]')
          .locator(`button[data-skill="${skill.id}"]`)
          .click();
        await expect(page.getByTestId('skill-detail')).toContainText(skill.name);
      }
      expect(await page.evaluate(() => window.__animateCalls)).toBe(0);
      expect(await runningAnimations(page)).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  }
});
