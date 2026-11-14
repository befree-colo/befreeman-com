import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getBus } from '@befreeman/mfe-contract';
import { content, mountAt, settle, text, vi } from '../../test/harness';

beforeEach(() => vi.mocked(Element.prototype.scrollIntoView).mockClear());
afterEach(() => document.body.replaceChildren());

const cards = (el: HTMLElement) => [...el.querySelectorAll('[data-testid="achievement-list"] > li[data-entity-id]')];
const toggleChip = async (el: HTMLElement, value: string, selected = true) => {
  const chip = [...el.querySelectorAll<HTMLElement>('bf-chip[interactive]')].find((c) => (c as unknown as { value: string }).value === value)!;
  chip.dispatchEvent(new CustomEvent('bf-toggle', { detail: { selected, value }, bubbles: true, composed: true }));
  await settle();
};

describe('achievement list', () => {
  it('home (featured) shows only featured achievements without filters', async () => {
    const b = await content();
    const m = await mountAt('/');
    expect(cards(m.el)).toHaveLength(b.achievements.filter((a) => a.featured).length);
    expect(m.el.querySelector('[role="group"]')).toBeNull();
  });

  it('/achievements lists everything with technology and role filters', async () => {
    const b = await content();
    const m = await mountAt('/achievements');
    expect(cards(m.el)).toHaveLength(b.achievements.length);
    expect(m.el.querySelector('[aria-label="Filter achievements"]')).not.toBeNull();
    expect(text(m.el.querySelector('[data-testid="result-count"]')!)).toBe(`Showing ${b.achievements.length} of ${b.achievements.length} achievements`);
  });

  it('filters by technology and reflects it in the URL via nav:request (replace)', async () => {
    const b = await content();
    const m = await mountAt('/achievements');
    await toggleChip(m.el, 'angular');
    const expected = b.achievements.filter((a) => a.skills.includes('angular'));
    expect(cards(m.el).map((c) => c.getAttribute('data-entity-id'))).toEqual(expected.map((a) => a.id));
    expect(m.bus.published.at(-1)).toEqual({ name: 'nav:request', payload: { path: '/achievements?tech=angular', replace: true } });
  });

  it('filters by role, combines with technology, and clears', async () => {
    const b = await content();
    const role = b.roles[0]!;
    const m = await mountAt('/achievements', '', 'tech=typescript');
    await toggleChip(m.el, role.id);
    const expected = b.achievements.filter((a) => a.role === role.id && a.skills.includes('typescript'));
    expect(cards(m.el)).toHaveLength(expected.length);
    expect(m.bus.published.at(-1)?.payload).toEqual({ path: `/achievements?tech=typescript&role=${role.id}`, replace: true });
    await toggleChip(m.el, role.id, false);
    expect(cards(m.el)).toHaveLength(b.achievements.filter((a) => a.skills.includes('typescript')).length);
  });

  it('restores filters from the URL query on mount', async () => {
    const b = await content();
    const m = await mountAt('/achievements', '', 'tech=cloudflare');
    expect(cards(m.el)).toHaveLength(b.achievements.filter((a) => a.skills.includes('cloudflare')).length);
  });

  it('shows an empty state with a clear action when nothing matches', async () => {
    const b = await content();
    const m = await mountAt('/achievements', '', `tech=cloudflare&role=${b.roles.at(-1)!.id}`);
    expect(text(m.el)).toContain('No achievements match these filters.');
    m.el.querySelector<HTMLButtonElement>('li button')!.click();
    await settle();
    expect(cards(m.el)).toHaveLength(b.achievements.length);
  });

  it('opening a card asks the shell to navigate', async () => {
    const b = await content();
    const m = await mountAt('/achievements');
    const card = m.el.querySelector<HTMLElement>(`li[data-entity-id="${b.achievements[0]!.id}"] bf-card`)!;
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    card.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(m.bus.published.at(-1)).toEqual({ name: 'nav:request', payload: { path: `/achievements/${b.achievements[0]!.id}` } });
  });
});

describe('achievement detail', () => {
  it('shows impact, metrics, technologies, role link, and the linked case study', async () => {
    const b = await content();
    const a = b.achievements.find((x) => x.caseStudy && x.metrics?.length)!;
    const m = await mountAt(`/achievements/${a.id}`, a.id);
    const detail = m.el.querySelector('[data-testid="achievement-detail"]')!;
    expect(detail.querySelector('h1')?.textContent).toBe(a.title);
    for (const i of a.impact) expect(text(detail.querySelector('[data-testid="impact"]')!)).toContain(i);
    for (const metric of a.metrics!) expect(text(detail.querySelector('[data-testid="metrics"]')!)).toContain(metric.value);
    const tech = text(detail.querySelector('[data-testid="technologies"]')!);
    for (const id of a.skills) expect(tech).toContain(b.skills.find((s) => s.id === id)!.name);
    const caseStudy = b.caseStudies.find((c) => c.id === a.caseStudy)!;
    expect(text(detail.querySelector('[data-testid="case-study"]')!)).toContain(caseStudy.title);
  });

  it('the role link navigates to the timeline through the bus', async () => {
    const b = await content();
    const a = b.achievements[0]!;
    const m = await mountAt(`/achievements/${a.id}`, a.id);
    const link = m.el.querySelector<HTMLAnchorElement>('[data-testid="role-link"]')!;
    expect(link.getAttribute('href')).toBe(`/timeline#${a.role}`);
    link.click();
    expect(m.bus.published.at(-1)).toEqual({ name: 'nav:request', payload: { path: `/timeline#${a.role}` } });
  });

  it('renders a not-found state for an unknown id', async () => {
    const m = await mountAt('/achievements/ghost', 'ghost');
    expect(text(m.el.querySelector('[data-testid="not-found"]')!)).toContain('There is no achievement called “ghost”');
  });
});

describe('entity:focus', () => {
  it('highlights and scrolls to the focused achievement', async () => {
    const b = await content();
    const target = b.achievements[2]!;
    const m = await mountAt('/achievements');
    getBus('agent').publish('entity:focus', { type: 'achievement', id: target.id });
    await settle();
    const li = m.el.querySelector<HTMLElement>(`li[data-entity-id="${target.id}"]`)!;
    expect(li.dataset['focused']).toBe('true');
    expect((li.querySelector('bf-card') as unknown as { highlighted: boolean }).highlighted).toBe(true);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(m.el.querySelectorAll('li[data-focused="true"]')).toHaveLength(1);
  });

  it('focusing a role highlights every achievement linked to that role', async () => {
    const b = await content();
    const role = b.roles[0]!;
    const m = await mountAt('/achievements');
    getBus('timeline').publish('entity:focus', { type: 'role', id: role.id });
    await settle();
    const focused = [...m.el.querySelectorAll('li[data-focused="true"]')].map((li) => li.getAttribute('data-entity-id'));
    expect(focused).toEqual(b.achievements.filter((a) => a.role === role.id).map((a) => a.id));
  });

  it('ignores focus on entities it does not display, without errors', async () => {
    const m = await mountAt('/achievements');
    getBus('x').publish('entity:focus', { type: 'achievement', id: 'not-here' });
    await settle();
    expect(m.el.querySelectorAll('li[data-focused="true"]')).toHaveLength(0);
  });
});
