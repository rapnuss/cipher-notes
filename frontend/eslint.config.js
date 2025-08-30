// eslint.config.js
import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import reactCompiler from 'eslint-plugin-react-compiler';

export default [
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['dist/**', 'eslint.config.js', 'vite.config.ts', 'pwa-assets.config.ts', 'vitest.config.ts', 'licensesTemplate.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2020,
        ...globals.serviceworker,
        ComlinkWorker: 'readonly',
        VITE_HOSTING_MODE: 'readonly',
      },
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'react-compiler': reactCompiler,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...typescriptEslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', {allowConstantExport: true}],
      eqeqeq: 2,
      'react-compiler/react-compiler': 'error',
      'no-constant-binary-expression': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-redeclare': 'off',
      'no-dupe-class-members': 'off',
      'no-empty': 'off',
    },
  },
]
