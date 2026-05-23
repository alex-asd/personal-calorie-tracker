import js from '@eslint/js';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';

const unusedVarsRule = [
  'warn',
  { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
];

export default [
  {
    ignores: [
      'client/dist/**',
      'node_modules/**',
      'client/node_modules/**',
      'data/**',
      'coverage/**',
    ],
  },

  js.configs.recommended,

  // Server + repo-root scripts (Node, ESM)
  {
    files: ['server/**/*.js', '*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': unusedVarsRule,
    },
  },

  // Client (Browser + React + JSX)
  {
    files: ['client/**/*.{js,jsx}'],
    ...reactPlugin.configs.flat.recommended,
    languageOptions: {
      ...reactPlugin.configs.flat.recommended.languageOptions,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    plugins: {
      ...reactPlugin.configs.flat.recommended.plugins,
      'react-hooks': reactHooks,
    },
    // React is installed under client/node_modules, not the root — pin the
    // version so eslint-plugin-react doesn't warn about failing to detect it.
    settings: { react: { version: '18.3' } },
    rules: {
      ...reactPlugin.configs.flat.recommended.rules,
      ...reactHooks.configs.flat.recommended.rules,
      // New JSX transform (React 17+/Vite) — no need to import React in scope.
      'react/react-in-jsx-scope': 'off',
      // Single-user project, no public API surface — PropTypes are noise.
      'react/prop-types': 'off',
      // Stylistic only; browsers render raw quotes/apostrophes in JSX text fine.
      'react/no-unescaped-entities': 'off',
      // react-hooks v7 flags every setState-triggering call in useEffect.
      // The classic `useEffect(() => refresh(), [refresh])` data-fetch pattern
      // is used throughout this app; keep exhaustive-deps on, drop this one.
      'react-hooks/set-state-in-effect': 'off',
      'no-unused-vars': unusedVarsRule,
    },
  },

  // Vite config file (Node context, not browser)
  {
    files: ['client/vite.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Turn off stylistic rules that conflict with Prettier — must be last.
  prettierConfig,
];
