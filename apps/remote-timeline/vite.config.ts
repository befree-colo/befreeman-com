import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { federation } from '@module-federation/vite';
import { fileURLToPath } from 'node:url';

export const isCustomElement = (tag: string) => tag.startsWith('bf-');

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  plugins: [
    vue({ template: { compilerOptions: { isCustomElement } } }),
    tailwindcss(),
    federation({
      name: 'bf_timeline',
      filename: 'remoteEntry.js',
      exposes: { './mount': './src/mount.ts' },
      manifest: true,
      dts: false,
    }),
  ],
  build: {
    outDir: fileURLToPath(new URL('../../dist/apps/remote-timeline', import.meta.url)),
    emptyOutDir: true,
    target: 'es2022',
    modulePreload: false,
    minify: true,
  },
  server: { port: 4202, strictPort: true, cors: true, origin: 'http://localhost:4202' },
  preview: { port: 4202, strictPort: true, cors: true },
});
