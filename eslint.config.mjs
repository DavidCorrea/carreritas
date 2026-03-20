import js from '@eslint/js';
import globals from 'globals';

const unusedVarRule = [
  'error',
  {
    argsIgnorePattern: '^_',
    varsIgnorePattern: '^_',
    caughtErrorsIgnorePattern: '^_',
  },
];

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['main.js', 'src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2025,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        THREE: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': unusedVarRule,
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-var': 'error',
      'prefer-const': ['error', { ignoreReadBeforeAssign: true }],
      'object-shorthand': ['error', 'always'],
      'prefer-exponentiation-operator': 'error',
    },
  },
  {
    files: ['api/**/*.js'],
    languageOptions: {
      ecmaVersion: 2025,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': unusedVarRule,
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-var': 'error',
      'prefer-const': ['error', { ignoreReadBeforeAssign: true }],
      'object-shorthand': ['error', 'always'],
      'prefer-exponentiation-operator': 'error',
    },
  },
  {
    files: ['vite.config.js'],
    languageOptions: {
      ecmaVersion: 2025,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': unusedVarRule,
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-var': 'error',
      'prefer-const': ['error', { ignoreReadBeforeAssign: true }],
      'object-shorthand': ['error', 'always'],
      'prefer-exponentiation-operator': 'error',
    },
  },
];
