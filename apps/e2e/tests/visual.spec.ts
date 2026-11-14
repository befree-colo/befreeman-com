import type { Locator, Page } from '@playwright/test';
import { expect, loadBundle, test, waitForRemotes, waitForShell } from './fixtures';

const bundle = loadBundle();
const LABEL = 'See achievements';

/** A role that has achievements, and a skill one of them uses: both remotes then render the button. */
const achievement = bundle.achievements[0]!;
const role = bundle.roles.find((r) => r.id === achievement.role)!;
const skill = bundle.skills.find((s) => s.id === achievement.skills[0])!;

type Remote = 'achievements' | 'timeline' | 'skills';

/** Open the page where each remote renders its secondary/sm bf-button, and return that button. */
async function openButton(page: Page, remote: Remote): Promise<Locator> {
  const live = page.locator(`.bf-remote-host[data-remote="${remote}"]`);
  if (remote === 'achievements') {
    await page.goto(`/achievements/${achievement.id}`);
    await waitForShell(page);
    await waitForRemotes(page);
    return live.getByTestId('role-achievements');
  }
  if (remote === 'timeline') {
    await page.goto('/timeline');
    await waitForShell(page);
    await waitForRemotes(page);
    const item = live.locator(`li[data-entity-id="${role.id}"]`);
    await item.getByTestId('expand').click();
    return item.getByTestId('role-achievements');
  }
  await page.goto('/skills');
  await waitForShell(page);
  await waitForRemotes(page);
  await live.locator(`button[data-skill="${skill.id}"]`).click();
  return live.getByTestId('skill-achievements');
}

/**
 * Pin the button at the same integer position on a plain backdrop, with the same label, so the only
 * thing left to differ is how each framework hosts the component.
 */
async function isolate(button: Locator): Promise<void> {
  await expect(button).toBeVisible();
  await button.evaluate((el, label) => {
    el.textContent = label;
    Object.assign((el as HTMLElement).style, {
      position: 'fixed',
      top: '24px',
      left: '24px',
      zIndex: '2147483647',
      display: 'inline-block',
      padding: '8px',
      background: 'rgb(128, 128, 128)',
    });
  }, LABEL);
}

const shot = (button: Locator) => button.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' });

async function capture(page: Page, remote: Remote): Promise<Record<'rest' | 'focus' | 'hover', Buffer>> {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  const button = await openButton(page, remote);
  await isolate(button);
  const rest = await shot(button);
  await page.keyboard.press('Shift'); // keyboard modality, so programmatic focus shows the focus ring
  await button.evaluate((el) => (el as HTMLElement).focus());
  const focus = await shot(button);
  await button.evaluate((el) => (el.shadowRoot?.activeElement as HTMLElement | null)?.blur());
  await button.hover();
  const hover = await shot(button);
  return { rest, focus, hover };
}

/**
 * Fraction of pixels whose channels differ by more than `threshold`, computed in a blank page
 * (the site's own CSP rightly forbids fetching data: URLs).
 */
async function diffRatio(page: Page, a: Buffer, b: Buffer, threshold = 32): Promise<number> {
  const scratch = await page.context().newPage();
  try {
    return await scratch.evaluate(
      async ({ a, b, threshold }) => {
        const load = async (b64: string) => {
          const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
          const c = new OffscreenCanvas(bmp.width, bmp.height);
          const ctx = c.getContext('2d')!;
          ctx.drawImage(bmp, 0, 0);
          return ctx.getImageData(0, 0, bmp.width, bmp.height);
        };
        const [x, y] = await Promise.all([load(a), load(b)]);
        if (x.width !== y.width || x.height !== y.height) return 1;
        let diff = 0;
        for (let i = 0; i < x.data.length; i += 4) {
          const d = Math.max(...[0, 1, 2, 3].map((k) => Math.abs(x.data[i + k]! - y.data[i + k]!)));
          if (d > threshold) diff++;
        }
        return diff / (x.width * x.height);
      },
      { a: a.toString('base64'), b: b.toString('base64'), threshold },
    );
  } finally {
    await scratch.close();
  }
}

test.describe('shared button across frameworks', () => {
  test('the same bf-button variant looks identical in the Angular, Vue, and React remotes', async ({
    page,
  }, info) => {
    const angular = await capture(page, 'achievements');
    const vue = await capture(page, 'timeline');
    const react = await capture(page, 'skills');
    for (const state of ['rest', 'focus', 'hover'] as const) {
      await info.attach(`angular-${state}.png`, { body: angular[state], contentType: 'image/png' });
      await info.attach(`vue-${state}.png`, { body: vue[state], contentType: 'image/png' });
      await info.attach(`react-${state}.png`, { body: react[state], contentType: 'image/png' });
      expect(
        await diffRatio(page, angular[state], vue[state]),
        `Angular vs Vue (${state})`,
      ).toBeLessThanOrEqual(0.005);
      expect(
        await diffRatio(page, angular[state], react[state]),
        `Angular vs React (${state})`,
      ).toBeLessThanOrEqual(0.005);
    }
    // The states are really different renderings, so the comparison above is not vacuous.
    expect(await diffRatio(page, angular.rest, angular.focus)).toBeGreaterThan(0.01);
    expect(await diffRatio(page, angular.rest, angular.hover)).toBeGreaterThan(0.01);
  });

  test('activating the button navigates to the filtered achievements list in every remote', async ({
    page,
  }) => {
    for (const [remote, query] of [
      ['achievements', `role=${role.id}`],
      ['timeline', `role=${role.id}`],
      ['skills', `tech=${skill.id}`],
    ] as const) {
      const button = await openButton(page, remote);
      await button.click();
      await expect(page).toHaveURL(`/achievements?${query}`);
      const live = page.locator('.bf-remote-host[data-remote="achievements"]');
      const expected = bundle.achievements.filter((a) =>
        query.startsWith('role') ? a.role === role.id : a.skills.includes(skill.id),
      );
      await expect(live.getByTestId('result-count')).toHaveText(
        `Showing ${expected.length} of ${bundle.achievements.length} achievements`,
      );
    }
  });
});
