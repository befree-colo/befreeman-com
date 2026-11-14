import type { Env as WorkerEnv } from '../src/env';

declare global {
  namespace Cloudflare {
    // Bindings from wrangler.test.jsonc, as seen by `import { env } from 'cloudflare:workers'`.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface -- declaration merging
    interface Env extends WorkerEnv {}
  }
}

export {};
