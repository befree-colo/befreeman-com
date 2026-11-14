import { describe, expect, it, vi } from 'vitest';
import { fetchManifest } from './manifest';

const manifest = {
  v: 1,
  content: { version: 'c1', url: '/content/content.c1.json' },
  ui: { version: 'u1', entry: '/ui/u1/ui.js' },
  remotes: { skills: { version: 's1', entry: '/remotes/skills/s1/remoteEntry.js', type: 'script', scope: 'bf_skills', framework: 'react' } },
};

describe('fetchManifest', () => {
  it('fetches /mfe-manifest.json without cache and validates it', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(manifest)));
    const m = await fetchManifest(fetchFn as unknown as typeof fetch);
    expect(fetchFn).toHaveBeenCalledWith('/mfe-manifest.json', expect.objectContaining({ cache: 'no-cache' }));
    expect(m.remotes['skills']?.version).toBe('s1');
  });
  it('rejects invalid manifests and HTTP errors', async () => {
    await expect(fetchManifest((async () => new Response('{"v":9}')) as unknown as typeof fetch)).rejects.toThrow();
    await expect(fetchManifest((async () => new Response('', { status: 503 })) as unknown as typeof fetch)).rejects.toThrow(/503/);
  });
});
