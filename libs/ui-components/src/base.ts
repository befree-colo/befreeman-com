// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- ambient ?inline CSS module declaration for type-only consumers
/// <reference path="./css.d.ts" />
import { LitElement, unsafeCSS } from 'lit';
import type { CSSResultGroup } from 'lit';
import componentCss from './styles.css?inline';

/** One parsed sheet for all components (Lit adopts it as a constructable stylesheet). */
export const sharedStyles = unsafeCSS(componentCss);

export class BfElement extends LitElement {
  static override styles: CSSResultGroup = [sharedStyles];
}

/** The focused element, looking through open shadow roots. */
export function deepActiveElement(root: Document | ShadowRoot = document): Element | null {
  let active = root.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}
