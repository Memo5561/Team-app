// Project-specific ESLint configuration blocks (docs/architecture/architektur.md §14).
// Kept separate from eslint.config.js so tests/lint can verify them in isolation as well.

/** @typedef {import('eslint').Linter.Config} Config */

/**
 * Layer architecture: app → modules → platform → components → lib. Feature modules never import
 * each other; paths are resolved before checking (config/eslint-plugin-teampanel.js).
 *
 * @param {import('eslint').ESLint.Plugin} teampanelPlugin
 * @returns {Config}
 */
export function architectureConfig(teampanelPlugin) {
  return {
    name: 'teampanel/architecture',
    files: ['src/**/*.{ts,tsx}'],
    plugins: { teampanel: teampanelPlugin },
    rules: { 'teampanel/layers': 'error' },
  };
}

/**
 * Technical JSX attributes that never carry user-visible text. Every other attribute (including
 * custom props such as `description`) is checked, so new text props are covered by default.
 * Entries are full-match regular expressions.
 */
const NON_TEXT_ATTRIBUTES = [
  'className',
  'style',
  'type',
  'key',
  'id',
  'name',
  'role',
  'href',
  'to',
  'src',
  'srcSet',
  'sizes',
  'rel',
  'target',
  'method',
  'action',
  'htmlFor',
  'form',
  'lang',
  'dir',
  'autoComplete',
  'inputMode',
  'enterKeyHint',
  'accept',
  'pattern',
  'loading',
  'decoding',
  'crossOrigin',
  'referrerPolicy',
  'variant',
  'size',
  'side',
  'align',
  'orientation',
  'asChild',
  'width',
  'height',
  'viewBox',
  'xmlns',
  'd',
  'fill',
  'stroke',
  'data-.*',
  'aria-(?:labelledby|describedby|controls|owns|hidden|live|current|expanded|selected|checked|pressed|haspopup|invalid|disabled|required|level|activedescendant|atomic|busy|modal|multiline|orientation|readonly|relevant|sort)',
];

/**
 * No hard-coded user-visible text in JSX (spec §66): text nodes, template literals and every
 * attribute except the technical ones above.
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
          'should-validate-template': true,
          'jsx-attributes': { exclude: NON_TEXT_ATTRIBUTES },
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
        selector: 'MemberExpression[property.name=/^(?:innerHTML|outerHTML|srcdoc)$/]',
        message: 'Writing HTML via innerHTML/outerHTML/srcdoc is forbidden (XSS).',
      },
      {
        selector: 'Property[key.name=/^(?:innerHTML|outerHTML|srcdoc)$/]',
        message: 'Setting innerHTML/outerHTML/srcdoc is forbidden (XSS).',
      },
      {
        selector:
          'CallExpression[callee.property.name=/^(?:insertAdjacentHTML|createContextualFragment|setHTMLUnsafe|parseHTMLUnsafe)$/]',
        message: 'HTML-parsing DOM APIs are forbidden (XSS).',
      },
      {
        selector:
          "CallExpression[callee.object.name='document'][callee.property.name=/^(?:write|writeln)$/]",
        message: 'document.write is forbidden (XSS).',
      },
    ],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
  },
};
