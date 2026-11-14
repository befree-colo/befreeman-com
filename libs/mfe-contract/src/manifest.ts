import { z } from './zod';

/**
 * The deployment manifest (`/mfe-manifest.json`). One JSON document, swapped
 * atomically, decides which version of every independently released artifact is live.
 */
export const MANIFEST_VERSION = 1 as const;

const versionSchema = z.string().min(1).max(64).regex(/^[0-9A-Za-z.+_-]+$/, 'invalid version string');

export const remoteEntrySchema = z.object({
  version: versionSchema,
  /** Same-origin URL of the remote entry, e.g. `/remotes/timeline/1.2.0-abc1234/remoteEntry.js`. */
  entry: z.string().startsWith('/'),
  /** `module` for ESM entries (Vite, Angular), `script` for classic entries. */
  type: z.enum(['module', 'script']),
  /** Module Federation container name, e.g. `bf_timeline`. */
  scope: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
  framework: z.string().min(1),
});

export const manifestSchema = z.object({
  v: z.literal(MANIFEST_VERSION),
  shell: z.object({ version: versionSchema }).optional(),
  content: z.object({ version: versionSchema, url: z.string().startsWith('/') }),
  ui: z.object({ version: versionSchema, entry: z.string().startsWith('/') }),
  remotes: z.record(z.string(), remoteEntrySchema),
});

export type RemoteManifestEntry = z.infer<typeof remoteEntrySchema>;
export type DeploymentManifest = z.infer<typeof manifestSchema>;

export function parseManifest(data: unknown): DeploymentManifest {
  return manifestSchema.parse(data);
}
