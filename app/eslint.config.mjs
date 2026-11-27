// Studio lint gate (intake #199). Every finding is a warning unless STUDIO_LINT_STRICT=1, so CI cannot go
// red until the warnings are fixed in small PRs; then set the repository variable STUDIO_LINT_STRICT=1.
// The studio-sync will replace this file with the managed copy from studio-agents.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactNative from 'eslint-plugin-react-native';

const strict = process.env.STUDIO_LINT_STRICT === '1';
const level = (v) => (strict ? v : v === 'off' ? 'off' : 'warn');
const soften = (rules) => Object.fromEntries(Object.entries(rules).map(([k, v]) => {
  const sev = Array.isArray(v) ? v[0] : v;
  const rest = Array.isArray(v) ? v.slice(1) : [];
  const out = level(sev === 0 ? 'off' : sev === 1 ? 'warn' : sev === 2 ? 'error' : sev);
  return [k, rest.length ? [out, ...rest] : out];
}));

export default [
  { linterOptions: { reportUnusedDisableDirectives: 'warn' } },
  { ignores: ['dist*/**', 'node_modules/**', '.expo/**', 'public/**', 'coverage/**', '**/*.config.js', 'scripts/**'] },
  ...[js.configs.recommended, ...tseslint.configs.recommended].map((c) => (c.rules ? { ...c, rules: soften(c.rules) } : c)),
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser, ...globals.jest, __DEV__: 'readonly' } },
    plugins: { 'react-hooks': reactHooks, 'react-native': reactNative },
    rules: {
      ...soften({
        ...reactHooks.configs.recommended.rules,
        'react-native/no-unused-styles': 'warn',
        'react-native/no-inline-styles': 'warn',
        'react-native/no-raw-text': 'off',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      }),
    },
  },
  // INTAKE-204 (Nov 26): require() is how jest.mock/resetModules tests load a module after the mock is set, and the
  // e2e and jest setup files are CommonJS Node scripts. Production code under src/ stays covered.
  {
    files: ['**/__tests__/**', 'src/test/**', 'e2e-web/**', 'jest.*.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
];
