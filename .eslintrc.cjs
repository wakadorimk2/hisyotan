module.exports = {
    root: true,
    env: {
        browser: true,
        node: true,
        es2022: true,
    },
    extends: ['eslint:recommended', 'plugin:import/recommended', 'plugin:prettier/recommended'],
    plugins: ['import'],
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
    },
    rules: {
        'no-unused-vars': 'warn',
        'import/order': ['warn', { groups: ['builtin', 'external', 'internal'] }],
    },
};
