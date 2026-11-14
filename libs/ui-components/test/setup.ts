import axe from 'axe-core';
import documentCss from '@befreeman/design-system/css/document.css?inline';
import '../src/index';

let installed = false;
/** Load page-level CSS once (what the shell does) and reset mode. */
export function installPage(theme: 'light' | 'dark' = 'light'): void {
  if (!installed) {
    const style = document.createElement('style');
    style.textContent = documentCss;
    document.head.append(style);
    document.documentElement.lang = 'en';
    document.title = 'ui-components test';
    installed = true;
  }
  document.documentElement.dataset['theme'] = theme;
}

export function fixture<T extends HTMLElement>(markup: string): T {
  const wrap = document.createElement('main');
  wrap.innerHTML = markup;
  document.body.replaceChildren(wrap);
  return wrap.firstElementChild as T;
}

export async function settle(el: Element): Promise<void> {
  await (el as unknown as { updateComplete?: Promise<unknown> }).updateComplete;
  await new Promise((r) => requestAnimationFrame(() => r(null)));
}

/** Wait for every running animation (including inside shadow roots) to finish. */
export async function finishAnimations(): Promise<void> {
  const roots: (Document | ShadowRoot)[] = [document];
  for (const el of document.querySelectorAll('*')) if (el.shadowRoot) roots.push(el.shadowRoot);
  const animations = roots.flatMap((r) => r.getAnimations());
  await Promise.all(animations.map((a) => a.finished.catch(() => undefined)));
}

/** Run axe against the page (shadow DOM aware) and return violations as readable strings. */
export async function axeViolations(): Promise<string[]> {
  await finishAnimations();
  const result = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } });
  return result.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
}
