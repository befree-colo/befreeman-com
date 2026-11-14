import { act } from 'react';
import { buildBundle } from '@befreeman/content/node';
import type { CareerContentBundle } from '@befreeman/content';
import type { Theme } from '@befreeman/mfe-contract';
import { mountInShadow } from '@befreeman/mfe-contract/testing';
import type { MountedRemote } from '@befreeman/mfe-contract/testing';
import { mount } from '../src/mount';

declare const __CONTENT_DIR__: string;

let cached: CareerContentBundle | null = null;
export async function content(): Promise<CareerContentBundle> {
  cached ??= await buildBundle(__CONTENT_DIR__);
  return cached;
}

export async function mountAt(path = '/skills', theme: Theme = 'light'): Promise<MountedRemote<CareerContentBundle>> {
  const c = await content();
  let m!: MountedRemote<CareerContentBundle>;
  await act(async () => {
    m = await mountInShadow(mount, { route: { path }, content: c, theme, meta: { name: 'skills', version: 'test', framework: 'react' } });
  });
  return m;
}

export const run = (fn: () => void) => act(async () => fn());
export const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
