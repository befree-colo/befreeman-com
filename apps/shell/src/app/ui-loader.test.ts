import { describe, expect, it, vi } from 'vitest';
import { UI_TAGS, loadUi } from './ui-loader';

describe('loadUi', () => {
  it('resolves only after every bf-* tag is defined', async () => {
    let defined = false;
    const importer = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 20));
      for (const t of UI_TAGS) if (!customElements.get(t)) customElements.define(t, class extends HTMLElement {});
      defined = true;
    });
    await loadUi('/ui/1/ui.js', 1000, importer);
    expect(importer).toHaveBeenCalledWith('/ui/1/ui.js');
    expect(defined).toBe(true);
  });

  it('rejects when the library does not load in time', async () => {
    await expect(loadUi('/ui/x.js', 30, () => new Promise(() => undefined))).rejects.toThrow(/timed out/);
  });
});
