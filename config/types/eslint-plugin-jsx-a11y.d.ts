// eslint-plugin-jsx-a11y ships no type declarations; only the flat configs are used.
declare module 'eslint-plugin-jsx-a11y' {
  import type { ESLint, Linter } from 'eslint';

  const plugin: ESLint.Plugin & {
    flatConfigs: Record<'recommended' | 'strict', Linter.Config>;
  };
  export default plugin;
}
