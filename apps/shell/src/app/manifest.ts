import { parseManifest } from '@befreeman/mfe-contract';
import type { DeploymentManifest } from '@befreeman/mfe-contract';
import type { CareerContentBundle } from '@befreeman/content';

export async function fetchManifest(fetchFn: typeof fetch = fetch): Promise<DeploymentManifest> {
  const res = await fetchFn('/mfe-manifest.json', { cache: 'no-cache', credentials: 'same-origin' });
  if (!res.ok) throw new Error(`manifest request failed: ${res.status}`);
  return parseManifest(await res.json());
}

export async function fetchContent(url: string, fetchFn: typeof fetch = fetch): Promise<CareerContentBundle> {
  const res = await fetchFn(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`content request failed: ${res.status}`);
  return (await res.json()) as CareerContentBundle;
}
