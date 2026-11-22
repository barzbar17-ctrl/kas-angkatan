import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

// Batas kode dari adendum MNX-01 dan SEC-05/SEC-08.
const limits = {
  complexity: ['error', 10],
  'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
  'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
};

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'public', '.dev-api'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      ...limits,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': 'allow-with-description',
          'ts-expect-error': 'allow-with-description',
          minimumDescriptionLength: 10,
        },
      ],
      // SEC-05: tidak ada penyambungan string ke SQL.
      'no-restricted-properties': [
        'error',
        { object: 'sql', property: 'unsafe', message: 'sql.unsafe dilarang (SEC-05).' },
        { object: 'tx', property: 'unsafe', message: 'sql.unsafe dilarang (SEC-05).' },
      ],
      // SEC-08: tidak memakai dangerouslySetInnerHTML.
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML dilarang (SEC-08).',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: { ...reactHooks.configs.recommended.rules, ...jsxA11y.flatConfigs.recommended.rules },
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    // Tes membaca JSON respons yang bentuknya dinamis; pelonggaran hanya berlaku di folder tes.
    rules: {
      'max-lines-per-function': 'off',
      'max-lines': 'off',
      complexity: 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  {
    files: ['**/*.mjs', '*.config.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
