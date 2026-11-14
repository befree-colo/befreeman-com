/**
 * Define a custom element only if the tag is free. A page has one registry, so a
 * second copy of this library (or a second load) must never throw or replace the
 * first definition.
 */
export function defineOnce(tag: string, ctor: CustomElementConstructor): void {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}
