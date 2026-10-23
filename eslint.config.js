import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'dev-dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // Architectural invariant: only src/data (repositories/queries) and src/services may
    // talk to Dexie. Components and hooks go through repositories — otherwise persistence
    // logic, transactions and derived-field upkeep leak back into the UI.
    files: ['src/components/**/*.{ts,tsx}', 'src/hooks/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['**/db/db', '**/db/db.ts', '../../db/*', '../../../db/*'],
            message: 'UI must not import the Dexie database. Use a repository from src/data/repositories instead.',
          },
          {
            group: ['dexie'],
            message:
              'UI must not import the dexie package directly (a private Dexie instance would bypass the repository boundary). Use a repository from src/data/repositories instead; useLiveQuery from dexie-react-hooks remains allowed.',
          },
        ],
      }],
    },
  },
])
