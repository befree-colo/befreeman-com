import nx from '@nx/eslint-plugin';
import prettier from 'eslint-config-prettier';
import pluginVue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/node_modules', '**/.nx', '**/tmp', '**/.wrangler', '**/test-results', '**/playwright-report', '**/.pnpm-store', '**/.lighthouseci'],
  },
  ...pluginVue.configs['flat/recommended'].map((c) => ({ ...c, files: ['**/*.vue'] })),
  {
    files: ['**/*.vue'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    languageOptions: { parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'], sourceType: 'module' } },
    rules: {
      // Components are single-purpose remotes; one-word names (Timeline.vue) are intentional.
      'vue/multi-word-component-names': 'off',
      // `slot="..."` here is the native Web Components slot attribute for bf-* elements, not Vue's deprecated syntax.
      'vue/no-deprecated-slot-attribute': 'off',
      // Formatting is Prettier's job.
      'vue/first-attribute-linebreak': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.mjs', '**/*.vue'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: false,
          allow: [],
          depConstraints: [
            { sourceTag: 'type:app', onlyDependOnLibsWithTags: ['type:lib'] },
            { sourceTag: 'type:remote', onlyDependOnLibsWithTags: ['type:lib'] },
            { sourceTag: 'type:lib', onlyDependOnLibsWithTags: ['type:lib'] },
            { sourceTag: 'type:tool', onlyDependOnLibsWithTags: ['type:lib'] },
            { sourceTag: 'type:e2e', onlyDependOnLibsWithTags: ['type:lib'] },
          ],
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@befreeman/remote-*', '@befreeman/shell', '@befreeman/edge', '@befreeman/e2e'],
              message: 'Apps and remotes must never import each other; communicate through @befreeman/mfe-contract.',
            },
          ],
        },
      ],
    },
  },
  {
    // Remotes get bf-* components from the shell at runtime (one registry per page).
    // They may import types only; importing the runtime entry would register a second copy.
    files: ['apps/remote-*/**/*.ts', 'apps/remote-*/**/*.tsx', 'apps/remote-*/**/*.vue'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@befreeman/ui-components',
              message: 'Remotes must not bundle the ui-components runtime; use @befreeman/ui-components/types (types only).',
              allowTypeImports: true,
            },
          ],
          patterns: [
            {
              group: ['@befreeman/ui-components/src/*', '**/ui-components/src/*'],
              message: 'Remotes must not bundle the ui-components runtime; use @befreeman/ui-components/types (types only).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/test/**/*.ts', '**/tests/**/*.ts', '**/*.typecheck.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off', '@typescript-eslint/no-empty-function': 'off' },
  },
  {
    files: ['**/eslint.config.mjs', '**/*.config.{ts,mts,js,mjs}'],
    rules: { '@nx/enforce-module-boundaries': 'off' },
  },
  prettier,
];
