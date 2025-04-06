export default [
    {
        ignores: [
            'node_modules',
            'dist',
            'backend/.venv',
            '**/site-packages/**',
        ],
        files: ['**/*.js', '**/*.mjs'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
        },
        rules: {
            'no-unused-vars': 'warn',
        },
    },
];
