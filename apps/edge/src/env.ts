export interface Env {
  ASSETS: Fetcher;
  ARTIFACTS: R2Bucket;
  MANIFESTS: KVNamespace;
  /** HMAC secret for signed preview overrides (wrangler secret). */
  PREVIEW_SECRET?: string;
  /** The production host (wrangler var). Any other host is served with `X-Robots-Tag: noindex`. */
  CANONICAL_HOST?: string;
}

export const DEFAULT_CANONICAL_HOST = 'befreeman.com';

export const LIVE_MANIFEST_KEY = 'manifest:live';
export const HISTORY_PREFIX = 'manifest:history:';
