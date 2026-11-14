declare const __BF_PRODUCTION__: boolean;

export const PRODUCTION: boolean = typeof __BF_PRODUCTION__ !== 'undefined' && __BF_PRODUCTION__;

/** Per-remote load+mount budget before falling back to the pre-rendered content. */
export const REMOTE_TIMEOUT_MS = 8000;
export const UI_TIMEOUT_MS = 8000;
