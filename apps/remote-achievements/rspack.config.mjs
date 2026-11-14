// @ts-check
import { createConfig } from '@nx/angular-rspack';
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/postcss';

const root = fileURLToPath(new URL('.', import.meta.url));

const configs = await createConfig(
  {
    options: {
      root,
      browser: './src/main.ts',
      index: './src/index.html',
      tsConfig: './tsconfig.app.json',
      polyfills: [],
      outputPath: { base: '../../dist/apps/remote-achievements', browser: '' },
      outputHashing: 'none',
      skipTypeChecking: false,
      devServer: { port: 4201, headers: { 'Access-Control-Allow-Origin': '*' } },
    },
  },
  {
    production: { options: { optimization: true, sourceMap: true } },
    development: { options: { optimization: false, sourceMap: true } },
  },
);

/** `import css from './styles.css?inline'` → Tailwind-compiled CSS string (adopted into the shadow root). */
const inlineCssRule = {
  resourceQuery: /inline/,
  type: 'asset/source',
  use: [{ loader: 'postcss-loader', options: { postcssOptions: { plugins: [tailwindcss()] } } }],
};

for (const config of configs) {
  for (const rule of config.module?.rules ?? []) {
    if (rule && typeof rule === 'object' && String(rule.test).includes('css') && Array.isArray(rule.oneOf) && !String(rule.test).includes('scss')) {
      rule.oneOf.unshift(inlineCssRule);
    }
  }
  config.output = {
    ...config.output,
    path: fileURLToPath(new URL('../../dist/apps/remote-achievements', import.meta.url)),
    publicPath: 'auto',
    uniqueName: 'bf_achievements',
  };
  config.optimization = { ...config.optimization, runtimeChunk: false };
  config.plugins = [
    ...(config.plugins ?? []),
    new ModuleFederationPlugin({
      name: 'bf_achievements',
      filename: 'remoteEntry.js',
      library: { type: 'module' },
      exposes: { './mount': './src/mount.ts' },
      dts: false,
      manifest: true,
    }),
  ];
}

export default configs;
