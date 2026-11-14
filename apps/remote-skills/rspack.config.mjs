// @ts-check
import { defineConfig } from '@rspack/cli';
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/postcss';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig((env, argv) => {
  const isProd = argv.mode === 'production';
  return {
    context: root,
    entry: {},
    mode: isProd ? 'production' : 'development',
    devtool: isProd ? 'source-map' : 'eval-cheap-module-source-map',
    output: {
      path: fileURLToPath(new URL('../../dist/apps/remote-skills', import.meta.url)),
      publicPath: 'auto',
      uniqueName: 'bf_skills',
      clean: true,
    },
    resolve: { extensions: ['.tsx', '.ts', '.js'] },
    module: {
      rules: [
        {
          // `import css from './styles.css?inline'` → Tailwind-compiled CSS string for the shadow root.
          test: /\.css$/,
          resourceQuery: /inline/,
          type: 'asset/source',
          use: [{ loader: 'postcss-loader', options: { postcssOptions: { plugins: [tailwindcss()] } } }],
        },
        {
          test: /\.tsx?$/,
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: { syntax: 'typescript', tsx: true },
              transform: { react: { runtime: 'automatic' } },
            },
          },
          type: 'javascript/auto',
        },
      ],
    },
    plugins: [
      new ModuleFederationPlugin({
        name: 'bf_skills',
        filename: 'remoteEntry.js',
        exposes: { './mount': './src/mount.tsx' },
        dts: false,
        manifest: true,
      }),
    ],
    devServer: {
      port: 4203,
      headers: { 'Access-Control-Allow-Origin': '*' },
      historyApiFallback: false,
    },
  };
});
