import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBus } from '@befreeman/mfe-contract';
import { colors } from '@befreeman/design-system';
import { content, mountAt, run, text } from '../test/harness';
import { fills } from '../test/setup';
import { buildRadar } from './radar';

const skillButton = (el: HTMLElement, id: string) => el.querySelector<HTMLButtonElement>(`button[data-skill="${id}"]`)!;
const key = (target: Element, k: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }));

beforeEach(() => {
  fills.length = 0;
  vi.mocked(Element.prototype.scrollIntoView).mockClear();
  history.replaceState({}, '', '/skills');
});
afterEach(() => document.body.replaceChildren());

describe('skills remote: mount contract', () => {
  it('mounts, renders, unmounts, and leaves no DOM or bus listeners', async () => {
    const m = await mountAt();
    expect(m.el.querySelector('[data-testid="skill-group"]')).not.toBeNull();
    expect(m.bus.live()).toBeGreaterThan(0);
    await run(() => void m.instance.unmount());
    expect(m.el.childNodes).toHaveLength(0);
    expect(m.bus.live()).toBe(0);
  });

  it('adopts its stylesheet into the host shadow root', async () => {
    const m = await mountAt();
    expect(m.root.adoptedStyleSheets.length).toBeGreaterThan(0);
  });
});

describe('radar model', () => {
  it('places every skill on its category axis with radius = proficiency / 5', async () => {
    const b = await content();
    const model = buildRadar(b);
    expect(model.axes.map((a) => a.id)).toEqual(b.skillCategories.map((c) => c.id));
    expect(model.points).toHaveLength(b.skills.length);
    for (const p of model.points) {
      expect(p.radius).toBeCloseTo(p.skill.proficiency / 5);
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(p.radius);
    }
  });
});

describe('skills radar', () => {
  it('groups skills by category with relative proficiency', async () => {
    const b = await content();
    const m = await mountAt();
    for (const c of b.skillCategories) expect(text(m.el)).toContain(c.name);
    const s = b.skills[0]!;
    expect(text(skillButton(m.el, s.id))).toContain(`${s.proficiency}/5`);
  });

  it('selecting a skill reveals the achievements that demonstrate it', async () => {
    const b = await content();
    const skill = 'typescript';
    const m = await mountAt();
    await run(() => skillButton(m.el, skill).click());
    expect(skillButton(m.el, skill).getAttribute('aria-pressed')).toBe('true');
    const detail = m.el.querySelector('[data-testid="skill-detail"]')!;
    const expected = b.achievements.filter((a) => a.skills.includes(skill));
    expect([...detail.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(expected.map((a) => `/achievements/${a.id}`));
  });

  it('is fully keyboard operable: one tab stop, arrows move, Enter selects, links reachable', async () => {
    const b = await content();
    const m = await mountAt();
    const ordered = b.skillCategories.flatMap((c) => c.skills);
    const tabbable = [...m.el.querySelectorAll<HTMLButtonElement>('button[data-skill]')].filter((x) => x.tabIndex === 0);
    expect(tabbable.map((x) => x.dataset['skill'])).toEqual([ordered[0]]); // roving tabindex

    skillButton(m.el, ordered[0]!).focus();
    await run(() => key(skillButton(m.el, ordered[0]!), 'ArrowRight'));
    expect(m.root.activeElement).toBe(skillButton(m.el, ordered[1]!));
    await run(() => key(skillButton(m.el, ordered[1]!), 'End'));
    expect(m.root.activeElement).toBe(skillButton(m.el, ordered.at(-1)!));
    await run(() => key(skillButton(m.el, ordered.at(-1)!), 'ArrowRight'));
    expect(m.root.activeElement).toBe(skillButton(m.el, ordered[0]!)); // wraps
    await run(() => key(skillButton(m.el, ordered[0]!), 'ArrowLeft'));
    expect(m.root.activeElement).toBe(skillButton(m.el, ordered.at(-1)!));

    // Enter on a native button activates it (click); jsdom needs the click dispatched.
    await run(() => skillButton(m.el, 'typescript').click());
    const links = m.el.querySelectorAll<HTMLAnchorElement>('[data-testid="skill-detail"] a');
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]!.tabIndex).toBe(0);
  });

  it('achievement links ask the shell to navigate', async () => {
    const m = await mountAt();
    await run(() => skillButton(m.el, 'typescript').click());
    const link = m.el.querySelector<HTMLAnchorElement>('[data-testid="skill-detail"] a')!;
    const e = new MouseEvent('click', { bubbles: true, cancelable: true });
    await run(() => link.dispatchEvent(e));
    expect(e.defaultPrevented).toBe(true);
    expect(m.bus.published.at(-1)).toEqual({ name: 'nav:request', payload: { path: link.getAttribute('href') } });
  });

  it('offers a table view as the text alternative', async () => {
    const b = await content();
    const m = await mountAt();
    const tableButton = [...m.el.querySelectorAll('button')].find((x) => x.textContent === 'Table view')!;
    await run(() => tableButton.click());
    const table = m.el.querySelector('[data-testid="skills-table"]')!;
    expect(table.querySelectorAll('tbody tr')).toHaveLength(b.skills.length);
    expect(table.querySelector('caption')).not.toBeNull();
    for (const s of b.skills) expect(text(table)).toContain(`${s.name}`);
  });

  it('draws the radar with the current mode palette', async () => {
    const m = await mountAt('/skills', 'light');
    const canvas = m.el.querySelector<HTMLCanvasElement>('[data-testid="radar-canvas"]')!;
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
    expect(canvas.dataset['drawnTheme']).toBe('light');
    expect(fills).toContain(colors.light.accent);
  });
});

describe('entity:focus and theme:changed', () => {
  it('entity:focus selects and scrolls to the skill', async () => {
    const m = await mountAt();
    await run(() => void getBus('agent').publish('entity:focus', { type: 'skill', id: 'aws' }));
    expect(skillButton(m.el, 'aws').getAttribute('aria-pressed')).toBe('true');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(m.el.querySelector<HTMLCanvasElement>('[data-testid="radar-canvas"]')!.dataset['selected']).toBe('aws');
  });

  it('ignores focus on entities it does not display', async () => {
    const m = await mountAt();
    await run(() => void getBus('x').publish('entity:focus', { type: 'role', id: 'aws' }));
    await run(() => void getBus('x').publish('entity:focus', { type: 'skill', id: 'cobol' }));
    expect(m.el.querySelectorAll('button[aria-pressed="true"][data-skill]')).toHaveLength(0);
  });

  it('redraws the canvas with the dark palette when the mode changes', async () => {
    const m = await mountAt('/skills', 'light');
    fills.length = 0;
    await run(() => void getBus('shell').publish('theme:changed', { theme: 'dark' }));
    const canvas = m.el.querySelector<HTMLCanvasElement>('[data-testid="radar-canvas"]')!;
    expect(canvas.dataset['drawnTheme']).toBe('dark');
    expect(fills).toContain(colors.dark.accent);
    expect(fills).not.toContain(colors.light.accent);
  });

  it('a /skills#<id> deep link preselects the skill', async () => {
    history.replaceState({}, '', '/skills#kubernetes');
    const m = await mountAt();
    expect(skillButton(m.el, 'kubernetes').getAttribute('aria-pressed')).toBe('true');
  });
});
