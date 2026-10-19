// @vitest-environment node
import { ESLint } from 'eslint';
import i18next from 'eslint-plugin-i18next';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { architectureConfigs, i18nConfig, securityConfig } from '../../config/eslint-rules.js';

// Verifies the project's own lint rules in isolation, so they cannot silently stop working.
const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ['**/*.{ts,tsx}'],
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
    },
    ...architectureConfigs(['time', 'schedule']),
    i18nConfig(i18next),
    securityConfig,
  ],
});

async function messagesFor(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map(
    (message) => `${message.ruleId ?? 'fatal'}: ${message.message}`,
  );
}

describe('architecture lint rules', () => {
  it('forbids imports between feature modules', async () => {
    const messages = await messagesFor(
      'src/modules/time/components/clock.tsx',
      "import { x } from '@/modules/schedule/api';\nexport const y = x;\n",
    );
    expect(messages).toEqual([
      expect.stringMatching(/^no-restricted-imports: .*other feature modules/),
    ]);
  });

  it('allows a module to import its own files and the platform layer', async () => {
    const messages = await messagesFor(
      'src/modules/time/components/clock.tsx',
      "import { a } from '@/modules/time/api';\nimport { b } from '@/platform/auth';\nimport { c } from './sibling';\nexport const y = [a, b, c];\n",
    );
    expect(messages).toEqual([]);
  });

  it('forbids climbing out of a directory with relative imports', async () => {
    const messages = await messagesFor(
      'src/modules/time/index.ts',
      "import { x } from '../schedule/api';\nexport const y = x;\n",
    );
    expect(messages).toEqual([expect.stringMatching(/^no-restricted-imports: .*"@\/" alias/)]);
  });

  it('keeps the platform layer independent of feature modules', async () => {
    const messages = await messagesFor(
      'src/platform/auth/session.ts',
      "import { x } from '@/modules/time/api';\nexport const y = x;\n",
    );
    expect(messages).toEqual([expect.stringMatching(/^no-restricted-imports: .*platform layer/)]);
  });

  it('keeps shared UI components free of domain code', async () => {
    const messages = await messagesFor(
      'src/components/ui/card.tsx',
      "import { x } from '@/platform/auth';\nexport const y = x;\n",
    );
    expect(messages).toEqual([expect.stringMatching(/^no-restricted-imports: .*domain code/)]);
  });
});

describe('i18n lint rule', () => {
  it('flags hard-coded JSX text and user-visible attributes', async () => {
    const messages = await messagesFor(
      'src/app/pages/example.tsx',
      'export const Example = () => <button title="Speichern">Mitarbeiter</button>;\n',
    );
    expect(messages).toHaveLength(2);
    expect(messages.every((message) => message.startsWith('i18next/no-literal-string'))).toBe(true);
  });

  it('allows translated text and technical attributes', async () => {
    const messages = await messagesFor(
      'src/app/pages/example.tsx',
      'declare const t: (key: string) => string;\nexport const Example = () => <button type="button" className="p-2" data-slot="x">{t(\'save\')}</button>;\n',
    );
    expect(messages).toEqual([]);
  });
});

describe('security lint rule', () => {
  it('forbids dangerouslySetInnerHTML', async () => {
    const messages = await messagesFor(
      'src/app/pages/example.tsx',
      'declare const html: string;\nexport const Example = () => <div dangerouslySetInnerHTML={{ __html: html }} />;\n',
    );
    expect(messages).toEqual([
      expect.stringMatching(/^no-restricted-syntax: dangerouslySetInnerHTML/),
    ]);
  });
});
