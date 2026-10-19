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
 * Technical JSX attributes that never carry user-visible text; the i18next rule ignores them.
 * Note: on native HTML/SVG elements the i18next plugin itself only checks a few attributes, so
 * TEXT_SELECTORS below cover the remaining visible ones. Entries are full-match regexes.
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
  'as',
  'width',
  'height',
  'viewBox',
  'xmlns',
  'd',
  'fill',
  'stroke',
  'min',
  'max',
  'step',
  'tabIndex',
  'scope',
  'colSpan',
  'rowSpan',
  // Values and identifiers passed to components (submit/button/reset `value` is covered below).
  'value',
  'defaultValue',
  'checked',
  'defaultChecked',
  'permission',
  'queryKey',
  'icon',
  'mode',
  'format',
  'locale',
  'timeZone',
  'end',
  'replace',
  'state',
  // Event handlers contain code, not text.
  'on[A-Z].*',
  'data-.*',
  'aria-(?:labelledby|describedby|controls|owns|hidden|live|current|expanded|selected|checked|pressed|haspopup|invalid|disabled|required|level|activedescendant|atomic|busy|modal|multiline|orientation|readonly|relevant|sort)',
];

/**
 * No hard-coded user-visible text in JSX (spec §66): text nodes, template literals and every
 * attribute except the technical ones above (completed by TEXT_SELECTORS for native elements).
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

// esquery regexes cannot contain "/", so \x2F stands for a slash.
const SECURITY_SELECTORS = [
  {
    selector: 'JSXAttribute[name.name=/^(?:dangerouslySetInnerHTML|srcDoc)$/]',
    message:
      'dangerouslySetInnerHTML/srcDoc are forbidden (XSS). Render text through React instead.',
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
      "CallExpression[callee.property.name='setAttribute'][arguments.0.value=/^(?:srcdoc|on.*)$/i]",
    message: 'Setting srcdoc or event-handler attributes via setAttribute is forbidden (XSS).',
  },
  {
    selector:
      'CallExpression[callee.property.name=/^(?:insertAdjacentHTML|createContextualFragment|setHTMLUnsafe|parseHTMLUnsafe)$/]',
    message: 'HTML-parsing DOM APIs are forbidden (XSS).',
  },
  {
    selector:
      "CallExpression[callee.property.name=/^(?:write|writeln)$/]:matches([callee.object.name='document'], [callee.object.property.name='document'])",
    message: 'document.write is forbidden (XSS).',
  },
];

const TAILWIND_COLOR_UTILITY =
  '(?:bg|text|border(?:-[trblxyse])?|ring|ring-offset|outline|fill|stroke|from|via|to|shadow|decoration|accent|caret|divide|placeholder)';
const PALETTE_NAMES =
  '(?:black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)';
const RAW_COLOR = `(?:^|\\s|:)${TAILWIND_COLOR_UTILITY}-\\[(?:#|rgba?\\(|hsla?\\(|oklch\\(|oklab\\(|lab\\(|lch\\(|color\\()`;
const PALETTE_COLOR = `(?:^|\\s|:)${TAILWIND_COLOR_UTILITY}-${PALETTE_NAMES}(?:-\\d{2,3})?(?:$|\\s|\\x2F)`;

/** Colors only via design tokens (spec §48): no arbitrary values, no (removed) palette classes. */
const DESIGN_TOKEN_SELECTORS = [RAW_COLOR, PALETTE_COLOR].flatMap((pattern) => [
  {
    selector: `Literal[value=/${pattern}/]`,
    message: 'Use design-token colors (src/styles/tokens.css), not raw or palette colors.',
  },
  {
    selector: `TemplateElement[value.raw=/${pattern}/]`,
    message: 'Use design-token colors (src/styles/tokens.css), not raw or palette colors.',
  },
]);

const VISIBLE_ATTRIBUTE =
  '^(?:aria-(?:label|description|roledescription|valuetext|placeholder)|label|title|alt|placeholder)$';

/** User-visible attributes on native HTML/SVG elements, which the i18next plugin skips. */
const TEXT_SELECTORS = [
  {
    selector: `JSXAttribute[name.name=/${VISIBLE_ATTRIBUTE}/][value.type='Literal']`,
    message: 'User-visible text must come from i18n (t(...)), not a literal.',
  },
  {
    selector: `JSXAttribute[name.name=/${VISIBLE_ATTRIBUTE}/] > JSXExpressionContainer > :matches(Literal[value=/[A-Za-z]/], TemplateLiteral)`,
    message: 'User-visible text must come from i18n (t(...)), not a literal.',
  },
  {
    selector:
      "JSXOpeningElement:has(JSXAttribute[name.name='type'][value.value=/^(?:submit|button|reset)$/]) > JSXAttribute[name.name='value']:matches([value.type='Literal'], [value.expression.type=/^(?:Literal|TemplateLiteral)$/])",
    message: 'Button labels (value) must come from i18n (t(...)), not a literal.',
  },
];

/**
 * no-restricted-syntax for src. One rule, two blocks: a later block replaces the rule's options,
 * so the .tsx block repeats the shared selectors and adds the text checks (not in tests).
 *
 * @type {Config[]}
 */
export const restrictedSyntaxConfigs = [
  {
    name: 'teampanel/security',
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', ...SECURITY_SELECTORS, ...DESIGN_TOKEN_SELECTORS],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
  {
    name: 'teampanel/security-and-text',
    files: ['src/**/*.tsx'],
    ignores: ['src/**/*.test.tsx', 'src/test/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...SECURITY_SELECTORS,
        ...DESIGN_TOKEN_SELECTORS,
        ...TEXT_SELECTORS,
      ],
    },
  },
];
