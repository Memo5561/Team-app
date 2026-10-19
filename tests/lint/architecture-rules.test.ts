// @vitest-environment node
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import i18next from 'eslint-plugin-i18next';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import teampanel from '../../config/eslint-plugin-teampanel.js';
import { architectureConfig, i18nConfig, securityConfig } from '../../config/eslint-rules.js';

// The project's own lint rules must not silently stop working, so they are tested twice:
// in isolation (fast, precise) and through the real eslint.config.js (wiring).
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

const isolated = new ESLint({
  cwd: repoRoot,
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ['**/*.{ts,tsx}'],
      languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
    },
    architectureConfig(teampanel),
    i18nConfig(i18next),
    securityConfig,
  ],
});

async function messagesFor(filePath: string, code: string, eslint = isolated): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((m) => `${m.ruleId ?? 'fatal'}: ${m.message}`);
}

const isLayerViolation = (message: string) => message.startsWith('teampanel/layers: ');

describe('layer architecture rule', () => {
  it.each([
    ['static import', "import { x } from '@/modules/schedule/api';"],
    ['re-export', "export { x } from '@/modules/schedule/api';"],
    ['star re-export', "export * from '@/modules/schedule/api';"],
    ['type import', "import type { X } from '@/modules/schedule/types';"],
    ['alias with ..', "import { x } from '@/modules/time/../schedule/api';"],
    ['relative ./..', "import { x } from './../../schedule/api';"],
    ['dynamic import', "export const load = () => import('@/modules/schedule/routes');"],
    ['import.meta.glob', "export const all = import.meta.glob('@/modules/schedule/*.ts');"],
    ['module registry', "import { registry } from '@/modules/registry';"],
    ['app shell', "import { routes } from '@/app/routes';"],
  ])(
    'blocks a feature module from reaching another module or the app (%s)',
    async (_case, code) => {
      const messages = await messagesFor('src/modules/time/components/clock.tsx', `${code}\n`);
      expect(messages.some(isLayerViolation)).toBe(true);
    },
  );

  it('allows a module to use itself, the platform, components and lib', async () => {
    const code = [
      "import { a } from '@/modules/time/api';",
      "import { b } from '@/platform/auth';",
      "import { Button } from '@/components/ui/button';",
      "import { cn } from '@/lib/utils';",
      "import { c } from './sibling';",
      "export const load = () => import('@/modules/time/routes');",
      'export const y = [a, b, c, Button, cn];',
    ].join('\n');
    expect(await messagesFor('src/modules/time/components/clock.tsx', code)).toEqual([]);
  });

  it('lets the module registry and the app shell wire modules together', async () => {
    const registry =
      "export const load = () => import('./time/routes');\nexport const all = import.meta.glob('./*/routes.ts');\n";
    expect(await messagesFor('src/modules/registry.ts', registry)).toEqual([]);
    expect(
      await messagesFor(
        'src/app/routes.tsx',
        "import { m } from '@/modules/time';\nexport const r = m;\n",
      ),
    ).toEqual([]);
  });

  it.each([
    [
      'platform → module',
      'src/platform/auth/session.ts',
      "import { x } from '@/modules/time/api';",
    ],
    [
      'platform → module via ./..',
      'src/platform/session.ts',
      "import { x } from './../modules/time/api';",
    ],
    ['components → platform', 'src/components/ui/card.tsx', "import { x } from '@/platform/auth';"],
    [
      'lib → components',
      'src/lib/thing.ts',
      "import { Button } from '@/lib/../components/ui/button';",
    ],
    ['lib → app', 'src/lib/thing.ts', "import { routes } from '@/app/routes';"],
  ])('enforces lower layers (%s)', async (_case, file, code) => {
    const messages = await messagesFor(file, `${code}\n`);
    expect(messages.some(isLayerViolation)).toBe(true);
  });

  it('requires string-literal paths for dynamic imports', async () => {
    const messages = await messagesFor(
      'src/modules/time/index.ts',
      'declare const name: string;\nexport const load = () => import(`@/modules/${name}`);\n',
    );
    expect(messages).toEqual([expect.stringMatching(/string literal path/)]);
  });

  it('ignores package imports', async () => {
    expect(
      await messagesFor('src/lib/x.ts', "import { z } from 'zod';\nexport const s = z;\n"),
    ).toEqual([]);
  });
});

describe('i18n rule', () => {
  it.each([
    ['JSX text', '<p>Mitarbeiter</p>'],
    ['visible attribute', '<button title="Speichern" />'],
    ['custom text prop', '<Message description="Hartkodierte Beschreibung" />'],
    ['template literal child', '<p>{`Template im Ausdruck`}</p>'],
    ['submit value', '<input type="submit" value="Absenden" readOnly />'],
    ['alt template', '<img alt={`Logo`} src="/logo.svg" />'],
  ])('flags hard-coded user-visible text (%s)', async (_case, jsx) => {
    const code = `declare const Message: (p: { description: string }) => null;\nexport const Example = () => ${jsx};\n`;
    const messages = await messagesFor('src/app/pages/example.tsx', code);
    expect(messages.some((m) => m.startsWith('i18next/no-literal-string'))).toBe(true);
  });

  it('allows translated text and technical attributes', async () => {
    const code = [
      'declare const t: (key: string) => string;',
      'declare const Link: (p: { to: string; className?: string; children: string }) => null;',
      'export const Example = () => (',
      '  <div className="p-2" data-slot="x" aria-hidden="true" role="presentation" id="a">',
      '    <Link to="/" className="underline">{t(\'save\')}</Link>',
      '    <img alt={t(\'logo\')} src="/logo.svg" width={32} />',
      '  </div>',
      ');',
    ].join('\n');
    expect(await messagesFor('src/app/pages/example.tsx', code)).toEqual([]);
  });
});

describe('security rule', () => {
  it.each([
    [
      'dangerouslySetInnerHTML',
      'export const Example = () => <div dangerouslySetInnerHTML={{ __html: html }} />;',
    ],
    ['innerHTML write', 'export function f(el: HTMLElement) { el.innerHTML = html; }'],
    ['outerHTML write', 'export function f(el: HTMLElement) { el.outerHTML = html; }'],
    [
      'insertAdjacentHTML',
      "export function f(el: HTMLElement) { el.insertAdjacentHTML('beforeend', html); }",
    ],
    ['document.write', 'export function f() { document.write(html); }'],
    ['eval', 'export function f() { return eval(html); }'],
  ])('forbids HTML/script sinks (%s)', async (_case, code) => {
    const messages = await messagesFor(
      'src/app/pages/example.tsx',
      `declare const html: string;\n${code}\n`,
    );
    expect(messages.length).toBeGreaterThan(0);
  });
});

describe('real eslint.config.js', () => {
  // Typed linting only accepts files that exist in a tsconfig project, so the probes reuse real
  // files and replace their content in memory (nothing is written to disk).
  const real = new ESLint({ cwd: repoRoot });

  it('applies the layer and security rules to src/lib', async () => {
    const code =
      "import { routes } from '@/app/routes';\nexport function f(el: HTMLElement) { el.innerHTML = String(routes.length); }\n";
    const messages = await messagesFor('src/lib/utils.ts', code, real);
    expect(messages.some((m) => m.startsWith('teampanel/layers'))).toBe(true);
    expect(messages.some((m) => m.startsWith('no-restricted-syntax'))).toBe(true);
  }, 30_000);

  it('applies the i18n rule to components in src/app', async () => {
    const code = 'export function HomePage() {\n  return <p>Hartkodiert</p>;\n}\n';
    const messages = await messagesFor('src/app/pages/home-page.tsx', code, real);
    expect(messages.some((m) => m.startsWith('i18next/no-literal-string'))).toBe(true);
  }, 30_000);
});
