// @ts-check
import { defineConfig } from '@rspack/cli';
import { rspack } from '@rspack/core';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const COMPOSE = process.env['BF_COMPOSE_URL'] ?? 'http://localhost:4300';

export default defineConfig((_env, argv) => {
  const isProd = argv.mode === 'production';
  return {
    context: root,
    entry: { main: './src/main.ts' },
    mode: isProd ? 'production' : 'development',
    devtool: isProd ? 'source-map' : 'eval-cheap-module-source-map',
    target: ['web', 'es2022'],
    output: {
      path: fileURLToPath(new URL('../../dist/apps/shell', import.meta.url)),
      publicPath: '/',
      filename: isProd ? 'assets/[name].[contenthash:8].js' : 'assets/[name].js',
      chunkFilename: isProd ? 'assets/[name].[contenthash:8].js' : 'assets/[name].js',
      cssFilename: isProd ? 'assets/[name].[contenthash:8].css' : 'assets/[name].css',
      assetModuleFilename: 'assets/[name].[hash:8][ext]',
      clean: true,
    },
    resolve: { extensions: ['.ts', '.js'] },
    module: {
      rules: [
        {
          test: /\.ts$/,
          loader: 'builtin:swc-loader',
          options: { jsc: { parser: { syntax: 'typescript' }, target: 'es2022' } },
          type: 'javascript/auto',
        },
        { test: /\.css$/, use: ['postcss-loader'], type: 'css/auto' },
        { test: /\.(woff2?)$/, type: 'asset/resource' },
      ],
    },
    plugins: [
      new rspack.DefinePlugin({ __BF_PRODUCTION__: JSON.stringify(isProd) }),
      new rspack.HtmlRspackPlugin({ template: './src/index.html', inject: 'body', scriptLoading: 'module', minify: false }),
      new rspack.CopyRspackPlugin({ patterns: [{ from: 'public', to: '.' }] }),
    ],
    performance: { hints: false },
    devServer: {
      port: 4200,
      historyApiFallback: true,
      proxy: [{ context: ['/mfe-manifest.json', '/remotes', '/ui', '/content'], target: COMPOSE }],
    },
  };
});
