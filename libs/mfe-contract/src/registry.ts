/**
 * Static facts about each independently released artifact: its Module Federation
 * scope, entry type, framework, build output, and the page that exercises it.
 * Shared by the release tooling and the local compose server.
 */
export const REMOTE_REGISTRY = {
  achievements: { scope: 'bf_achievements', type: 'module', framework: 'angular', dist: 'dist/apps/remote-achievements', page: '/achievements' },
  timeline: { scope: 'bf_timeline', type: 'module', framework: 'vue', dist: 'dist/apps/remote-timeline', page: '/timeline' },
  skills: { scope: 'bf_skills', type: 'script', framework: 'react', dist: 'dist/apps/remote-skills', page: '/skills' },
  patents: { scope: 'bf_patents', type: 'module', framework: 'svelte', dist: 'dist/apps/remote-patents', page: '/patents' },
} as const;

export type RegisteredRemote = keyof typeof REMOTE_REGISTRY;

export const UI_DIST = 'dist/libs/ui-components';
export const CONTENT_DIST = 'dist/libs/content';

export function isRegisteredRemote(name: string): name is RegisteredRemote {
  return Object.prototype.hasOwnProperty.call(REMOTE_REGISTRY, name);
}
