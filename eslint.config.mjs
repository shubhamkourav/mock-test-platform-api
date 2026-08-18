export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-unused-vars': 'off',
    },
  },
];
