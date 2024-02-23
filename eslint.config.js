// @ts-check
import js from '@eslint/js'
import ts from '@typescript-eslint/eslint-plugin'
// @ts-ignore
import { rules } from '@lucasols/eslint-plugin-extended-lint'
import vitest from 'eslint-plugin-vitest'
import tseslint from 'typescript-eslint'

const isCI = process.env.CI === 'true'

const OFF = 0
const WARN = 1
const ERROR = 2
const ERROR_IN_CI = isCI ? ERROR : WARN
const ERROR_IN_CI_ONLY = isCI ? ERROR : OFF

/** @type {import('eslint').Linter.FlatConfig[]} */
const config = [
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['dist/**', 'node_modules/**'],

    languageOptions: {
      // @ts-ignore
      parser: tseslint.parser,
      parserOptions: { project: './tsconfig.json' },
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      '@lucasols/extended-lint': { rules },
      vitest: vitest,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...ts.configs.recommended.rules,
      ...ts.configs['recommended-requiring-type-checking'].rules,

      'no-warning-comments': [ERROR_IN_CI, { terms: ['FIX:'] }],
      'no-constant-binary-expression': ERROR_IN_CI,
      'object-shorthand': ERROR_IN_CI,
      'no-useless-rename': ERROR_IN_CI,
      'no-param-reassign': ERROR_IN_CI,
      'prefer-template': ERROR_IN_CI,
      'prefer-const': [ERROR_IN_CI, { destructuring: 'all' }],
      'no-redeclare': OFF,

      'no-prototype-builtins': OFF,
      'no-inner-declarations': OFF,
      'no-undef': OFF,
      'no-console': [ERROR_IN_CI, { allow: ['warn', 'error', 'info'] }],
      'no-restricted-imports': [
        ERROR_IN_CI,
        {
          patterns: [
            {
              group: ['*.test'],
              message: 'Do not import test files',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        ERROR_IN_CI_ONLY,
        {
          selector: 'CallExpression[callee.property.name="only"]',
          message: 'No test.only',
        },
        {
          selector: 'CallExpression[callee.property.name="todo"]',
          message: 'No test.todo',
        },
      ],
      'no-implicit-coercion': [
        ERROR_IN_CI,
        { disallowTemplateShorthand: true, allow: ['!!'] },
      ],

      /* typescript */
      '@typescript-eslint/no-unnecessary-condition': ERROR_IN_CI,
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
      ],
      '@typescript-eslint/no-unused-expressions': ERROR_IN_CI,
      '@typescript-eslint/no-unused-vars': [
        ERROR_IN_CI,
        {
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-shadow': [
        ERROR_IN_CI,
        { ignoreOnInitialization: true, allow: ['expect'] },
      ],
      '@typescript-eslint/no-unsafe-call': ERROR_IN_CI,
      '@typescript-eslint/method-signature-style': ERROR_IN_CI,

      '@typescript-eslint/no-non-null-assertion': OFF,
      '@typescript-eslint/no-empty-function': OFF,
      '@typescript-eslint/no-explicit-any': OFF,
      '@typescript-eslint/no-floating-promises': OFF,
      '@typescript-eslint/no-unsafe-assignment': OFF,
      '@typescript-eslint/no-misused-promises': OFF,
      '@typescript-eslint/restrict-template-expressions': OFF,
      '@typescript-eslint/unbound-method': OFF,
      '@typescript-eslint/no-unsafe-return': OFF,
      '@typescript-eslint/no-unsafe-member-access': OFF,

      /* vitest */
      'vitest/no-identical-title': ERROR_IN_CI,
      'vitest/expect-expect': ERROR_IN_CI,

      /* extended-lint */
      '@lucasols/extended-lint/no-unused-type-props-in-args': ERROR_IN_CI,
    },
  },
]

export default config
