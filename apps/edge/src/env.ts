export interface Env {
  ASSETS: Fetcher;
  ARTIFACTS: R2Bucket;
  MANIFESTS: KVNamespace;
  /** HMAC secret for signed preview overrides (wrangler secret). */
  PREVIEW_SECRET?: string;
}

export const LIVE_MANIFEST_KEY = 'manifest:live';
export const HISTORY_PREFIX = 'manifest:history:';
