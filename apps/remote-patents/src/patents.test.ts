import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { formatDate, patentNumber, patentUrl } from '@befreeman/page-templates';
import { content, mountAt, text } from '../test/harness';

const items = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('[data-testid="patents"] > li')];

beforeEach(() => {
  vi.mocked(Element.prototype.scrollIntoView).mockClear();
  history.replaceState({}, '', '/patents');
});
afterEach(() => document.body.replaceChildren());

describe('patents remote: mount contract', () => {
  it('mounts, renders, unmounts, and leaves an empty host', async () => {
    const m = await mountAt();
    expect(m.el.querySelector('[data-testid="patents"]')).not.toBeNull();
    await m.instance.unmount();
    expect(m.el.childNodes).toHaveLength(0);
    expect(m.bus.live()).toBe(0);
  });

  it('adopts its stylesheet into the host shadow root', async () => {
    const m = await mountAt();
    expect(m.root.adoptedStyleSheets.length).toBeGreaterThan(0);
  });
});

describe('patents list', () => {
  it('renders its own section heading with the patent count', async () => {
    const b = await content();
    const m = await mountAt();
    expect(text(m.el.querySelector('h1'))).toBe('Patents');
    expect(text(m.el.querySelector('header'))).toContain(`${b.patents.length} issued U.S. patents`);
  });

  it('lists every patent newest first with number, date, assignee, summary, and links', async () => {
    const b = await content();
    const m = await mountAt();
    const lis = items(m.el);
    expect(lis.map((li) => li.dataset['entityId'])).toEqual(b.patents.map((p) => p.id));
    b.patents.forEach((p, i) => {
      const li = lis[i]!;
      const link = li.querySelector<HTMLAnchorElement>('h2 a')!;
      expect(link.getAttribute('href')).toBe(patentUrl(p.number));
      expect(link.target).toBe('_blank');
      expect(link.rel).toBe('noopener noreferrer');
      expect(text(link)).toBe(`${p.title} (opens Google Patents in a new tab)`);
      expect(text(li)).toContain(`${patentNumber(p.number)} · ${formatDate(p.issued)} · ${p.assignee}`);
      expect(text(li)).toContain(p.summary);
      expect(li.querySelector(`a[href="/timeline#${p.role}"]`)).not.toBeNull();
    });
  });

  it('re-renders when the shell sends new content', async () => {
    const b = await content();
    const m = await mountAt();
    const first = b.patents[0]!;
    m.instance.update?.({ ...m.ctx, content: { ...b, patents: [{ ...first, title: 'Renamed patent' }] } });
    flushSync();
    expect(items(m.el)).toHaveLength(1);
    expect(text(m.el.querySelector('h2'))).toContain('Renamed patent');
    expect(text(m.el.querySelector('header'))).toContain('1 issued U.S. patent,');
  });

  it('scrolls a deep-linked patent into view', async () => {
    const b = await content();
    const target = b.patents[3]!;
    history.replaceState({}, '', `/patents#${target.id}`);
    const m = await mountAt();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts[0]).toBe(m.el.querySelector(`[data-entity-id="${target.id}"]`));
  });
});
