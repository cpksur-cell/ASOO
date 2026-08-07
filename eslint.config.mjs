import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
})

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'src/app/tokens.generated.css',
      'dataconnect-generated/**',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      /**
       * Design-system enforcement. docs/05-design-system.md §10.
       *
       * These are the three rules that keep the system coherent as it grows:
       *   1. no raw hex           -> use a semantic token
       *   2. no physical CSS      -> use logical properties, or RTL breaks
       *   3. no `any`             -> CLAUDE.md §3
       */
      'no-restricted-syntax': [
        'error',
        {
          // Raw hex colours in JSX/TSX. Tokens only.
          selector: "Literal[value=/^#(?:[0-9a-fA-F]{3}){1,2}$/]",
          message:
            'Raw hex colour. Use a semantic token from design/tokens.json (e.g. text-text-primary, bg-surface-raised). See docs/05-design-system.md §2.',
        },
        {
          // Physical direction utilities in className strings.
          selector:
            "Literal[value=/(^|\\s)-?(ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|text-left|text-right)-/]",
          message:
            'Physical CSS direction. Use logical properties (ms/me, ps/pe, start/end, text-start/text-end) or RTL breaks. See docs/05-design-system.md §4.1.',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
]
