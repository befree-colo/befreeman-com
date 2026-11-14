import type { DeploymentManifest } from '@befreeman/mfe-contract';
import type { RemoteStatus } from './mounts';

/**
 * Visitor-toggleable view that outlines every remote and labels it with its name,
 * framework, and deployed version (or "unavailable" with the attempted version).
 */
export class ArchitectureView {
  private enabled = false;

  constructor(
    private readonly doc: Document,
    private readonly button: HTMLButtonElement | null,
    private manifest: DeploymentManifest | null = null,
    private readonly statuses: () => Map<string, RemoteStatus> = () => new Map(),
  ) {
    button?.addEventListener('click', () => this.toggle());
  }

  setManifest(manifest: DeploymentManifest): void {
    this.manifest = manifest;
    this.refresh();
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  toggle(force?: boolean): void {
    this.enabled = force ?? !this.enabled;
    this.doc.documentElement.toggleAttribute('data-arch', this.enabled);
    this.button?.setAttribute('aria-pressed', String(this.enabled));
    this.refresh();
  }

  refresh(): void {
    const shellLabel = this.doc.querySelector<HTMLElement>('[data-arch-shell]');
    if (shellLabel) shellLabel.textContent = `shell · host · ${this.manifest?.shell?.version ?? 'dev'}`;
    for (const slot of this.doc.querySelectorAll<HTMLElement>('[data-slot]')) {
      const name = slot.dataset['slot'] ?? '?';
      const status = this.statuses().get(name);
      const entry = this.manifest?.remotes[name];
      let label = slot.querySelector<HTMLElement>(':scope > .bf-arch-label');
      if (!label) {
        label = this.doc.createElement('span');
        label.className = 'bf-arch-label';
        slot.prepend(label);
      }
      const framework = entry?.framework ?? status?.framework ?? 'unknown';
      const version = entry?.version ?? status?.version ?? 'n/a';
      label.dataset['state'] = status?.state ?? 'pending';
      label.textContent =
        status?.state === 'failed'
          ? `${name} · unavailable · tried ${version}`
          : `${name} · ${framework} · ${version}${status?.state === 'mounted' ? '' : ' · loading'}`;
    }
  }
}
