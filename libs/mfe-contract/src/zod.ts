import { z } from 'zod';

/**
 * Zod probes for `new Function` support (to compile faster validators) with a
 * try/catch. Under the site's CSP (`script-src 'self'`, no `unsafe-eval`) every
 * probe is reported as a CSP violation, so turn the probe off. Each bundle has
 * its own Zod copy; importing schemas through this module configures it before
 * the first parse.
 */
z.config({ jitless: true });

export { z };
