const OFF = 0
const WARN = 1
const ERROR = 2

module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    createDefaultProgram: true,
    ecmaVersion: 8,
    ecmaFeatures: {
      jsx: true,
    },
    useJSXTextNode: true,
    sourceType: 'module',
  },
  env: {
    browser: true,
  },
  plugins: ['@typescript-eslint'],

  rules: {
    'no-warning-comments': [WARN, { terms: ['FIX-LATER:'] }],
    'no-constant-binary-expression': ERROR,

    /* typescript */
    '@typescript-eslint/no-explicit-any': OFF,
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'typeLike',
        format: ['PascalCase'],
      },
    ],
    '@typescript-eslint/no-throw-literal': ERROR,
    '@typescript-eslint/no-unused-expressions': ERROR,
    '@typescript-eslint/no-shadow': [ERROR, { ignoreOnInitialization: true }],

    /* jest */
    'jest/expect-expect': [ERROR, { assertFunctionNames: ['expect*'] }],
    'jest/no-deprecated-functions': OFF,
  },
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:jest/recommended',
    'plugin:jest/style',
  ],
}
