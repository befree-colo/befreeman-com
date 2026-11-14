import { afterEach, describe, expect, it } from 'vitest';
import { content, mountAt, settle, text } from '../test/harness';

afterEach(() => {
  document.body.replaceChildren();
});

describe('achievements remote: mount contract', () => {
  it('mounts through ./mount, renders, unmounts, and leaves no DOM or bus listeners', async () => {
    const m = await mountAt('/achievements');
    expect(m.el.querySelector('bf-achievements-root')).not.toBeNull();
    expect(text(m.el)).toContain((await content()).achievements[0]!.title);
    expect(m.bus.live()).toBeGreaterThan(0);

    await m.instance.unmount();
    expect(m.el.childNodes).toHaveLength(0);
    expect(m.bus.live()).toBe(0);
  });

  it('adopts its stylesheet into the host shadow root', async () => {
    const m = await mountAt('/achievements');
    expect(m.root.adoptedStyleSheets.length).toBeGreaterThan(0);
  });

  it('applies route updates without remounting', async () => {
    const m = await mountAt('/achievements');
    const a = (await content()).achievements[1]!;
    m.instance.update?.({ ...m.ctx, route: { path: `/achievements/${a.id}`, subPath: a.id, query: new URLSearchParams() } });
    await settle();
    expect(m.el.querySelector('[data-testid="achievement-detail"] h1')?.textContent).toBe(a.title);
  });
});
