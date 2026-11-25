import { buildBundle } from '@befreeman/content/node';
import type { CareerContentBundle } from '@befreeman/content';
import { mountInShadow, settle } from '@befreeman/mfe-contract/testing';
import type { MountedRemote } from '@befreeman/mfe-contract/testing';
import { mount } from '../src/mount';

declare const __CONTENT_DIR__: string;

let cached: CareerContentBundle | null = null;
export async function content(): Promise<CareerContentBundle> {
  cached ??= await buildBundle(__CONTENT_DIR__);
  return cached;
}

export async function mountAt(path = '/patents'): Promise<MountedRemote<CareerContentBundle>> {
  const m = await mountInShadow(mount, {
    route: { path },
    content: await content(),
    theme: 'light',
    meta: { name: 'patents', version: 'test', framework: 'svelte' },
  });
  await settle();
  return m;
}

export const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
export { settle };
