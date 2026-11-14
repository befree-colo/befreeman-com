import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBus } from '@befreeman/mfe-contract';
import { content, mountAt, settle, text } from '../test/harness';
import { setReducedMotion } from '../test/setup';

const item = (el: HTMLElement, id: string) => el.querySelector<HTMLElement>(`li[data-entity-id="${id}"]`)!;
const expandButton = (el: HTMLElement, id: string) => item(el, id).querySelector<HTMLButtonElement>('[data-testid="expand"]')!;

beforeEach(() => {
  vi.mocked(Element.prototype.scrollIntoView).mockClear();
  setReducedMotion(false);
  history.replaceState({}, '', '/timeline');
});
afterEach(() => document.body.replaceChildren());

describe('timeline remote: mount contract', () => {
  it('mounts, renders, unmounts, and leaves no DOM or bus listeners', async () => {
    const m = await mountAt();
    expect(m.el.querySelector('[data-testid="timeline"]')).not.toBeNull();
    expect(m.bus.live()).toBeGreaterThan(0);
    await m.instance.unmount();
    expect(m.el.childNodes).toHaveLength(0);
    expect(m.bus.live()).toBe(0);
  });

  it('adopts its stylesheet into the host shadow root', async () => {
    const m = await mountAt();
    expect(m.root.adoptedStyleSheets.length).toBeGreaterThan(0);
  });
});

describe('interactive timeline', () => {
  it('lists roles newest first with dates, title, and company', async () => {
    const b = await content();
    const m = await mountAt();
    const ids = [...m.el.querySelectorAll('[data-testid="timeline"] > li')].map((li) => li.getAttribute('data-entity-id'));
    expect(ids).toEqual(b.roles.map((r) => r.id));
    expect(text(item(m.el, b.roles[0]!.id))).toContain('Present');
    expect(text(item(m.el, b.roles[1]!.id))).toContain(b.roles[1]!.company);
  });

  it('expanding a role reveals responsibilities and linked achievements', async () => {
    const b = await content();
    const role = b.roles[0]!;
    const m = await mountAt();
    const button = expandButton(m.el, role.id);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(item(m.el, role.id).querySelector('[data-testid="panel"]')).toBeNull();

    button.click();
    await settle();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const panel = item(m.el, role.id).querySelector('[data-testid="panel"]')!;
    expect(button.getAttribute('aria-controls')).toBe(panel.id);
    for (const r of role.responsibilities) expect(text(panel)).toContain(r);
    for (const a of b.achievements.filter((x) => x.role === role.id)) {
      expect(panel.querySelector(`a[href="/achievements/${a.id}"]`)?.textContent).toBe(a.title);
    }

    button.click();
    await settle();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('expanding a role announces entity:focus so other remotes can highlight it', async () => {
    const b = await content();
    const m = await mountAt();
    expandButton(m.el, b.roles[1]!.id).click();
    await settle();
    expect(m.bus.published).toContainEqual({ name: 'entity:focus', payload: { type: 'role', id: b.roles[1]!.id } });
  });

  it('achievement links ask the shell to navigate', async () => {
    const b = await content();
    const role = b.roles[0]!;
    const a = b.achievements.find((x) => x.role === role.id)!;
    const m = await mountAt();
    expandButton(m.el, role.id).click();
    await settle();
    const link = item(m.el, role.id).querySelector<HTMLAnchorElement>(`a[href="/achievements/${a.id}"]`)!;
    const e = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(m.bus.published.at(-1)).toEqual({ name: 'nav:request', payload: { path: `/achievements/${a.id}` } });
  });

  it('offers a text-alternative list view with the same facts', async () => {
    const b = await content();
    const m = await mountAt();
    const listButton = [...m.el.querySelectorAll('button')].find((x) => x.textContent?.trim() === 'List view')!;
    listButton.click();
    await settle();
    expect(listButton.getAttribute('aria-pressed')).toBe('true');
    const list = m.el.querySelector('[data-testid="list-view"]')!;
    for (const r of b.roles) {
      expect(text(list)).toContain(`${r.title}, ${r.company}`);
      for (const resp of r.responsibilities) expect(text(list)).toContain(resp);
    }
    for (const a of b.achievements) expect(text(list)).toContain(a.title);
  });

  it('under reduced motion, expanding does not animate', async () => {
    setReducedMotion(true);
    const b = await content();
    const animate = vi.fn();
    HTMLElement.prototype.animate = animate as unknown as HTMLElement['animate'];
    const m = await mountAt();
    expandButton(m.el, b.roles[0]!.id).click();
    await settle();
    expect(item(m.el, b.roles[0]!.id).querySelector('[data-testid="panel"]')).not.toBeNull();
    expect(animate).not.toHaveBeenCalled();
  });

  it('animates the expansion when motion is allowed', async () => {
    const b = await content();
    const animate = vi.fn(() => ({ onfinish: null }));
    HTMLElement.prototype.animate = animate as unknown as HTMLElement['animate'];
    const m = await mountAt();
    expandButton(m.el, b.roles[0]!.id).click();
    await settle();
    expect(animate).toHaveBeenCalled();
  });
});

describe('entity:focus', () => {
  it('focusing a role expands, highlights, and scrolls to it', async () => {
    const b = await content();
    const role = b.roles[2]!;
    const m = await mountAt();
    getBus('agent').publish('entity:focus', { type: 'role', id: role.id });
    await settle();
    expect(item(m.el, role.id).dataset['focused']).toBe('true');
    expect(expandButton(m.el, role.id).getAttribute('aria-expanded')).toBe('true');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('focusing an achievement reveals the role it belongs to', async () => {
    const b = await content();
    const a = b.achievements.find((x) => x.role === b.roles[1]!.id)!;
    const m = await mountAt();
    getBus('agent').publish('entity:focus', { type: 'achievement', id: a.id });
    await settle();
    expect(item(m.el, a.role).dataset['focused']).toBe('true');
  });

  it('a /timeline#<role> deep link focuses that role on mount', async () => {
    const b = await content();
    history.replaceState({}, '', `/timeline#${b.roles[1]!.id}`);
    const m = await mountAt();
    expect(item(m.el, b.roles[1]!.id).dataset['focused']).toBe('true');
  });

  it('ignores entities it does not display', async () => {
    const m = await mountAt();
    getBus('x').publish('entity:focus', { type: 'role', id: 'nope' });
    getBus('x').publish('entity:focus', { type: 'skill', id: 'aws' });
    await settle();
    expect(m.el.querySelectorAll('[data-focused="true"]')).toHaveLength(0);
  });
});
