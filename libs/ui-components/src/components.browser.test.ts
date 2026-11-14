import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { axeViolations, fixture, installPage, settle } from '../test/setup';
import { TAGS, defineOnce, whenAllDefined } from './index';
import type { BfChip, BfDialog, BfThemeToggle } from './index';

const shadow = (el: Element, sel: string) => el.shadowRoot!.querySelector<HTMLElement>(sel)!;

afterEach(() => {
  document.body.replaceChildren();
});

describe('registration', () => {
  it('defines every tag', async () => {
    await whenAllDefined();
    for (const tag of TAGS) expect(customElements.get(tag), tag).toBeDefined();
  });

  it('defineOnce is a no-op for an already-defined tag (second library copy)', () => {
    const original = customElements.get('bf-button');
    expect(() => defineOnce('bf-button', class extends HTMLElement {})).not.toThrow();
    expect(customElements.get('bf-button')).toBe(original);
  });
});

describe('bf-button', () => {
  it('is keyboard operable: Tab focuses, Enter and Space activate', async () => {
    installPage();
    const el = fixture('<bf-button>Save</bf-button>');
    await settle(el);
    const onClick = vi.fn();
    el.addEventListener('click', onClick);
    await userEvent.tab();
    expect(el.shadowRoot!.activeElement?.tagName).toBe('BUTTON');
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('renders a link with href and is skipped when disabled', async () => {
    installPage();
    const el = fixture('<bf-button href="/achievements" disabled>Go</bf-button>');
    await settle(el);
    const a = shadow(el, 'a');
    expect(a.getAttribute('aria-disabled')).toBe('true');
    expect(a.hasAttribute('href')).toBe(false);
  });

  it('applies the shared theme (accent background)', async () => {
    installPage();
    const el = fixture('<bf-button>Go</bf-button>');
    await settle(el);
    expect(getComputedStyle(shadow(el, 'button')).backgroundColor).toBe('rgb(91, 61, 245)');
  });
});

describe('bf-chip', () => {
  it('interactive chips toggle with aria-pressed and emit bf-toggle', async () => {
    installPage();
    const el = fixture<BfChip>('<bf-chip interactive value="aws">AWS</bf-chip>');
    await settle(el);
    const events: unknown[] = [];
    el.addEventListener('bf-toggle', (e) => events.push((e as CustomEvent).detail));
    const button = shadow(el, 'button');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    button.focus();
    await userEvent.keyboard(' ');
    await settle(el);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(events).toEqual([{ selected: true, value: 'aws' }]);
  });

  it('static chips are not focusable', async () => {
    installPage();
    const el = fixture('<bf-chip>Tag</bf-chip>');
    await settle(el);
    expect(el.shadowRoot!.querySelector('button')).toBeNull();
  });
});

describe('bf-theme-toggle', () => {
  it('is a labelled switch that reports the new mode', async () => {
    installPage();
    const el = fixture<BfThemeToggle>('<bf-theme-toggle theme="light"></bf-theme-toggle>');
    await settle(el);
    const onChange = vi.fn();
    el.addEventListener('bf-theme-change', (e) => onChange((e as CustomEvent).detail));
    const control = shadow(el, 'button');
    expect(control.getAttribute('role')).toBe('switch');
    expect(control.getAttribute('aria-label')).toBe('Dark mode');
    expect(control.getAttribute('aria-checked')).toBe('false');
    control.focus();
    await userEvent.keyboard('{Enter}');
    await settle(el);
    expect(onChange).toHaveBeenCalledWith({ theme: 'dark' });
    expect(control.getAttribute('aria-checked')).toBe('true');
    expect(el.theme).toBe('dark');
  });
});

describe('bf-dialog', () => {
  async function openDialog() {
    installPage();
    const wrap = fixture<HTMLDivElement>(`<div>
      <button id="opener">Open</button>
      <bf-dialog><span slot="heading">Contact</span><p>Body</p>
        <bf-button slot="footer" id="ok">OK</bf-button></bf-dialog>
    </div>`);
    const dialog = wrap.querySelector<BfDialog>('bf-dialog')!;
    const opener = wrap.querySelector<HTMLButtonElement>('#opener')!;
    await settle(dialog);
    opener.focus();
    dialog.show();
    await settle(dialog);
    return { dialog, opener, native: dialog.shadowRoot!.querySelector('dialog')! };
  }

  it('moves focus into the dialog when opened and names it by its heading', async () => {
    const { dialog, native } = await openDialog();
    expect(native.open).toBe(true);
    expect(native.getAttribute('aria-labelledby')).toBe('heading');
    expect(document.activeElement).toBe(dialog);
  });

  it('traps focus: the page behind is inert while open', async () => {
    const { opener, dialog } = await openDialog();
    for (let i = 0; i < 6; i++) {
      await userEvent.tab();
      const active = document.activeElement;
      // Focus stays in the dialog, or leaves to browser UI (body), but never reaches page content.
      expect(active === document.body || active === dialog || !!dialog.contains(active)).toBe(true);
      expect(active).not.toBe(opener);
    }
    opener.focus();
    expect(document.activeElement).not.toBe(opener);
  });

  it('closes on Escape and returns focus to the opener', async () => {
    const { dialog, opener, native } = await openDialog();
    const onClose = vi.fn();
    dialog.addEventListener('bf-close', onClose);
    await userEvent.keyboard('{Escape}');
    await settle(dialog);
    expect(native.open).toBe(false);
    expect(dialog.open).toBe(false);
    expect(onClose).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(opener);
  });

  it('the close button closes it', async () => {
    const { dialog, native } = await openDialog();
    shadow(dialog, 'button[aria-label="Close"]').click();
    await settle(dialog);
    expect(native.open).toBe(false);
  });
});

describe.each(['light', 'dark'] as const)('accessibility in %s mode', (mode) => {
  it('the component catalog has no axe violations (including contrast)', async () => {
    installPage(mode);
    fixture(`<div>
      <h1>Catalog</h1>
      <bf-button>Primary</bf-button>
      <bf-button variant="secondary">Secondary</bf-button>
      <bf-button variant="ghost">Ghost</bf-button>
      <bf-button href="/x">Link button</bf-button>
      <bf-card><span slot="heading">Card</span>Body text <span slot="footer">Footer</span></bf-card>
      <bf-card variant="outline" href="/y"><span slot="heading">Link card</span>Body</bf-card>
      <bf-chip>Static</bf-chip>
      <bf-chip interactive>Toggle</bf-chip>
      <bf-chip interactive selected>Selected</bf-chip>
      <bf-theme-toggle></bf-theme-toggle>
    </div>`);
    for (const el of document.querySelectorAll('bf-button, bf-card, bf-chip, bf-theme-toggle')) await settle(el);
    expect(await axeViolations()).toEqual([]);
  });

  it('an open dialog has no axe violations', async () => {
    installPage(mode);
    const dialog = fixture<BfDialog>('<bf-dialog><span slot="heading">Hello</span><p>Body</p></bf-dialog>');
    await settle(dialog);
    dialog.show();
    await settle(dialog);
    expect(await axeViolations()).toEqual([]);
  });
});
