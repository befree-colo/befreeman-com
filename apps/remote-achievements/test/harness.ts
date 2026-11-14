import { buildBundle } from '@befreeman/content/node';
import type { CareerContentBundle } from '@befreeman/content';
import { mountInShadow, settle } from '@befreeman/mfe-contract/testing';
import type { MountedRemote } from '@befreeman/mfe-contract/testing';
import { vi } from 'vitest';
import { mount } from '../src/mount';

declare const __CONTENT_DIR__: string;

let cached: CareerContentBundle | null = null;
export async function content(): Promise<CareerContentBundle> {
  cached ??= await buildBundle(__CONTENT_DIR__);
  return cached;
}

export type Mounted = MountedRemote<CareerContentBundle>;

export async function mountAt(path: string, subPath = '', query = ''): Promise<Mounted> {
  const m = await mountInShadow(mount, {
    route: { path, subPath, query: new URLSearchParams(query) },
    content: await content(),
    theme: 'light',
    meta: { name: 'achievements', version: 'test', framework: 'angular' },
  });
  await settle();
  return m;
}

export function text(el: Element): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export { settle, vi };
