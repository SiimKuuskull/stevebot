'use strict';

module.exports = {
    env: {
        browser: true,
        es2021: true,
    },
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:prettier/recommended',
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 13,
    },
    plugins: ['@typescript-eslint'],
    rules: {
        '@typescript-eslint/no-empty-function': 'off',
        'object-curly-spacing': ['error', 'always'],
        'prettier/prettier': [
            'error',
            {
                singleQuote: true,
                tabWidth: 4,
                printWidth: 120,
                trailingComma: 'all',
                endOfLine: 'lf',
            },
        ],
    },
};
