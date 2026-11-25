import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { federation } from '@module-federation/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  plugins: [
    svelte(),
    tailwindcss(),
    federation({
      name: 'bf_patents',
      filename: 'remoteEntry.js',
      exposes: { './mount': './src/mount.ts' },
      manifest: true,
      dts: false,
    }),
  ],
  build: {
    outDir: fileURLToPath(new URL('../../dist/apps/remote-patents', import.meta.url)),
    emptyOutDir: true,
    target: 'es2022',
    modulePreload: false,
    minify: true,
  },
  server: { port: 4204, strictPort: true, cors: true, origin: 'http://localhost:4204' },
  preview: { port: 4204, strictPort: true, cors: true },
});
