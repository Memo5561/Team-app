// Project-specific ESLint rules that enforce TeamPanel's architecture (docs/architecture/architektur.md §14).
// Kept separate from eslint.config.js so tests/lint can verify them in isolation.

/** @typedef {import('eslint').Linter.Config} Config */

const RELATIVE_PARENT = {
  regex: '^\\.\\./',
  message: 'Import code outside the current directory via the "@/" alias.',
};

/**
 * @param {string} value
 * @returns {string}
 */
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {{ regex: string, message: string }[]} patterns
 * @returns {Config['rules']}
 */
function restrictImports(patterns) {
  return { 'no-restricted-imports': ['error', { patterns: [RELATIVE_PARENT, ...patterns] }] };
}

/**
 * Layering: app → modules → platform → components/lib. Feature modules never import each other.
 * Later blocks override earlier ones for the same rule, so the generic src block comes first.
 *
 * @param {string[]} moduleNames directory names below src/modules
 * @returns {Config[]}
 */
export function architectureConfigs(moduleNames) {
  return [
    {
      name: 'teampanel/architecture/src',
      files: ['src/**/*.{ts,tsx}'],
      rules: restrictImports([]),
    },
    {
      name: 'teampanel/architecture/lib',
      files: ['src/lib/**/*.{ts,tsx}', 'src/i18n/**/*.{ts,tsx}', 'src/types/**/*.{ts,tsx}'],
      rules: restrictImports([
        {
          regex: '^@/(?:app|modules|platform|components)(?:/|$)',
          message:
            'src/lib, src/i18n and src/types are the lowest layer and must not import app code.',
        },
      ]),
    },
    {
      name: 'teampanel/architecture/components',
      files: ['src/components/**/*.{ts,tsx}'],
      rules: restrictImports([
        {
          regex: '^@/(?:app|modules|platform)(?:/|$)',
          message: 'Shared UI components must stay free of domain code.',
        },
      ]),
    },
    {
      name: 'teampanel/architecture/platform',
      files: ['src/platform/**/*.{ts,tsx}'],
      rules: restrictImports([
        {
          regex: '^@/(?:app|modules)(?:/|$)',
          message: 'The platform layer must not depend on feature modules or the app shell.',
        },
      ]),
    },
    ...moduleNames.map((name) => ({
      name: `teampanel/architecture/modules/${name}`,
      files: [`src/modules/${name}/**/*.{ts,tsx}`],
      rules: restrictImports([
        {
          regex: `^@/modules/(?!${escapeRegex(name)}(?:/|$))`,
          message:
            'Feature modules must not import other feature modules. Move shared code to src/platform.',
        },
        {
          regex: '^@/app(?:/|$)',
          message: 'Feature modules must not depend on the app shell.',
        },
      ]),
    })),
  ];
}

/**
 * No hard-coded user-visible text in JSX (spec §66). Covers text nodes and the attributes
 * that screen readers or browsers show to users.
 *
 * @param {import('eslint').ESLint.Plugin} i18nextPlugin
 * @returns {Config}
 */
export function i18nConfig(i18nextPlugin) {
  return {
    name: 'teampanel/i18n',
    files: ['src/**/*.tsx'],
    ignores: ['src/**/*.test.tsx', 'src/test/**'],
    plugins: { i18next: i18nextPlugin },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          'jsx-attributes': {
            include: [
              'alt',
              'aria-label',
              'aria-description',
              'aria-placeholder',
              'aria-roledescription',
              'aria-valuetext',
              'label',
              'placeholder',
              'title',
            ],
          },
        },
      ],
    },
  };
}

/** @type {Config} */
export const securityConfig = {
  name: 'teampanel/security',
  files: ['src/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
        message: 'dangerouslySetInnerHTML is forbidden (XSS). Render text through React instead.',
      },
      {
        selector: "MemberExpression[property.name='innerHTML']",
        message: 'innerHTML is forbidden (XSS).',
      },
    ],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
  },
};
