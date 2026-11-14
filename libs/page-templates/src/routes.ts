export const REMOTE_NAMES = ['achievements', 'timeline', 'skills'] as const;
export type RemoteName = (typeof REMOTE_NAMES)[number];

export type RouteKind = 'home' | 'achievements' | 'timeline' | 'skills' | 'not-found';

export interface RouteMatch {
  kind: RouteKind;
  /** Normalized path (no trailing slash except root). */
  path: string;
  /** Remote that owns the route's prefix; null for shell pages. */
  owner: RemoteName | null;
  /** Remainder after the owner's prefix, e.g. the achievement id. */
  subPath: string;
  /** Remote slots present on this page, in document order. */
  slots: RemoteName[];
}

/** Top-level prefix ownership. Each prefix belongs to exactly one remote. */
export const PREFIXES: Record<RemoteName, string> = {
  achievements: '/achievements',
  timeline: '/timeline',
  skills: '/skills',
};

export function normalizePath(path: string): string {
  const clean = path.split(/[?#]/)[0] || '/';
  return clean.length > 1 ? clean.replace(/\/+$/, '') || '/' : '/';
}

export function matchRoute(rawPath: string): RouteMatch {
  const path = normalizePath(rawPath);
  if (path === '/') return { kind: 'home', path, owner: null, subPath: '', slots: [...REMOTE_NAMES] };
  for (const name of REMOTE_NAMES) {
    const prefix = PREFIXES[name];
    if (path === prefix || path.startsWith(prefix + '/')) {
      const subPath = decodeURIComponent(path.slice(prefix.length).replace(/^\//, ''));
      // Only achievements has sub-pages; anything deeper elsewhere is unknown.
      if (subPath && (name !== 'achievements' || subPath.includes('/'))) break;
      return { kind: name, path, owner: name, subPath, slots: [name] };
    }
  }
  return { kind: 'not-found', path, owner: null, subPath: '', slots: [] };
}

/** Every page that should be pre-rendered for the given achievement ids. */
export function prerenderPaths(achievementIds: string[]): string[] {
  return ['/', '/achievements', ...achievementIds.map((id) => `/achievements/${id}`), '/timeline', '/skills'];
}
