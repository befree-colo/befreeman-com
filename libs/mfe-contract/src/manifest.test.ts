import { describe, expect, it } from 'vitest';
import { parseManifest } from './manifest';

const valid = {
  v: 1,
  content: { version: '9e5e4fc3d8b0', url: '/content/content.9e5e4fc3d8b0.json' },
  ui: { version: '1.0.0-abc1234', entry: '/ui/1.0.0-abc1234/ui.js' },
  remotes: {
    timeline: { version: '1.0.0-abc1234', entry: '/remotes/timeline/1.0.0-abc1234/remoteEntry.js', type: 'module', scope: 'bf_timeline', framework: 'vue' },
  },
};

describe('deployment manifest', () => {
  it('accepts a valid manifest', () => {
    expect(parseManifest(valid).remotes['timeline']?.framework).toBe('vue');
  });
  it('rejects cross-origin entries (same-origin delivery)', () => {
    expect(() =>
      parseManifest({ ...valid, ui: { version: '1', entry: 'https://evil.example/ui.js' } }),
    ).toThrow();
  });
  it('rejects unknown manifest versions and bad scopes', () => {
    expect(() => parseManifest({ ...valid, v: 2 })).toThrow();
    expect(() =>
      parseManifest({ ...valid, remotes: { x: { ...valid.remotes.timeline, scope: 'bad-scope' } } }),
    ).toThrow();
  });
});
