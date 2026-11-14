import { decodeContact } from '@befreeman/content';
import type { CareerContentBundle } from '@befreeman/content';
import { contactLinks } from '@befreeman/page-templates';

/**
 * Contact dialog. The email address exists only as an obfuscated token in the
 * content bundle; it is decoded at click time and never written into the DOM.
 */
export function initContact(doc: Document, content: CareerContentBundle): void {
  const dialog = doc.getElementById('contact-dialog') as (HTMLElement & { show(): void; close(): void }) | null;
  if (!dialog) return;
  const links = dialog.querySelector('[data-contact-links]');
  if (links) links.innerHTML = contactLinks(content).__html;

  const emailButton = doc.getElementById('contact-email');
  const token = content.profile.contactToken;
  if (emailButton && token) {
    emailButton.hidden = false;
    emailButton.addEventListener('click', () => {
      window.location.href = `mailto:${decodeContact(token)}`;
    });
  }

  doc.addEventListener('click', (e) => {
    const trigger = e.composedPath().find((n): n is HTMLElement => n instanceof HTMLElement && n.hasAttribute('data-contact-trigger'));
    if (!trigger) return;
    e.preventDefault();
    dialog.show();
  });
}
