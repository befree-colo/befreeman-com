import { createInstance } from '@module-federation/enhanced/runtime';
import type { DeploymentManifest, RemoteModule } from '@befreeman/mfe-contract';

export interface RemoteLoader {
  load(name: string): Promise<RemoteModule>;
}

/** Register every remote from the manifest with the MF runtime and load `./mount` on demand. */
export function createRemoteLoader(manifest: DeploymentManifest): RemoteLoader {
  const mf = createInstance({ name: 'bf_shell', remotes: [] });
  mf.registerRemotes(
    Object.values(manifest.remotes).map((r) => ({
      name: r.scope,
      entry: r.entry,
      ...(r.type === 'module' ? { type: 'module' as const } : {}),
    })),
  );
  return {
    async load(name) {
      const r = manifest.remotes[name];
      if (!r) throw new Error(`remote "${name}" is not in the manifest`);
      const mod = await mf.loadRemote<RemoteModule & { default?: RemoteModule['mount'] }>(`${r.scope}/mount`);
      const mount = mod?.mount ?? mod?.default;
      if (typeof mount !== 'function') throw new Error(`remote "${name}" does not expose a mount function`);
      return { mount };
    },
  };
}
