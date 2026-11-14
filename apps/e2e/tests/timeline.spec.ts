import { expect, loadBundle, test, waitForShell } from './fixtures';

const bundle = loadBundle();

test.describe('timeline remote (Vue) in the composed site', () => {
  test('renders roles; expanding one reveals responsibilities and achievement links', async ({ page, consoleErrors }) => {
    await page.goto('/timeline');
    await waitForShell(page);
    const live = page.locator('.bf-remote-host[data-remote="timeline"]');
    const role = bundle.roles[0]!;
    const button = live.locator(`li[data-entity-id="${role.id}"]`).getByTestId('expand');
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(live.getByText(role.responsibilities[0]!)).toBeVisible();
    const a = bundle.achievements.find((x) => x.role === role.id)!;
    await live.getByRole('link', { name: a.title }).click();
    await expect(page).toHaveURL(`/achievements/${a.id}`);
    expect(consoleErrors).toEqual([]);
  });

  test('the achievement role link lands on the timeline with that role focused', async ({ page }) => {
    const a = bundle.achievements[0]!;
    await page.goto(`/achievements/${a.id}`);
    await waitForShell(page);
    await page.locator('.bf-remote-host[data-remote="achievements"]').getByTestId('role-link').click();
    await expect(page).toHaveURL(`/timeline#${a.role}`);
    await expect(page.locator(`.bf-remote-host[data-remote="timeline"] li[data-entity-id="${a.role}"]`)).toHaveAttribute('data-focused', 'true');
  });

  test('cross-remote: expanding a role in Vue highlights its achievements in Angular', async ({ page }) => {
    await page.goto('/');
    await waitForShell(page);
    for (const slot of await page.locator('[data-slot]').all()) await slot.scrollIntoViewIfNeeded();
    await expect(page.locator('[data-slot="achievements"]')).toHaveAttribute('data-remote-state', 'mounted');
    await expect(page.locator('[data-slot="timeline"]')).toHaveAttribute('data-remote-state', 'mounted');
    const role = bundle.roles[0]!;
    await page.locator(`.bf-remote-host[data-remote="timeline"] li[data-entity-id="${role.id}"]`).getByRole('button', { name: /Responsibilities/ }).click();
    const expected = bundle.achievements.filter((a) => a.featured && a.role === role.id).map((a) => a.id);
    expect(expected.length).toBeGreaterThan(0);
    for (const id of expected) {
      await expect(page.locator(`.bf-remote-host[data-remote="achievements"] li[data-entity-id="${id}"]`)).toHaveAttribute('data-focused', 'true');
    }
  });

  test('the list view is a usable text alternative', async ({ page }) => {
    await page.goto('/timeline');
    await waitForShell(page);
    const live = page.locator('.bf-remote-host[data-remote="timeline"]');
    await live.getByRole('button', { name: 'List view' }).click();
    for (const r of bundle.roles) await expect(live.getByRole('heading', { name: `${r.title}, ${r.company}` })).toBeVisible();
  });
});

test.describe('skills remote (React) in the composed site', () => {
  test('keyboard-only: tab into the radar, arrow between skills, select, reach an achievement', async ({ page, consoleErrors }) => {
    await page.goto('/skills');
    await waitForShell(page);
    const live = page.locator('.bf-remote-host[data-remote="skills"]');
    const first = bundle.skillCategories[0]!.skills[0]!;
    const second = bundle.skillCategories[0]!.skills[1]!;
    await live.locator(`button[data-skill="${first}"]`).focus();
    await page.keyboard.press('ArrowRight');
    await expect(live.locator(`button[data-skill="${second}"]`)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(live.locator(`button[data-skill="${second}"]`)).toHaveAttribute('aria-pressed', 'true');
    const expected = bundle.achievements.filter((a) => a.skills.includes(second));
    const firstLink = live.getByTestId('skill-detail').getByRole('link', { name: expected[0]!.title });
    await page.keyboard.press('Tab');
    // focus leaves the roving group to the next control, eventually reaching the detail links
    for (let i = 0; i < 20 && !(await firstLink.evaluate((el) => el === (el.getRootNode() as ShadowRoot).activeElement)); i++) {
      await page.keyboard.press('Tab');
    }
    await expect(firstLink).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`/achievements/${expected[0]!.id}`);
    expect(consoleErrors).toEqual([]);
  });

  test('the canvas redraws with the new palette when the mode changes', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/skills');
    await waitForShell(page);
    const canvas = page.locator('.bf-remote-host[data-remote="skills"] [data-testid="radar-canvas"]');
    await expect(canvas).toHaveAttribute('data-drawn-theme', 'light');
    await page.getByRole('switch', { name: 'Dark mode' }).click();
    await expect(canvas).toHaveAttribute('data-drawn-theme', 'dark');
  });
});
