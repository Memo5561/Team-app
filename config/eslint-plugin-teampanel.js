// Project ESLint plugin: enforces TeamPanel's layer architecture (docs/architecture/architektur.md §14).
//
// Unlike a regex on the raw import string, the rule resolves every specifier to a path below src/
// first, so tricks like './../x', '@/modules/a/../b', re-exports, dynamic import() and
// import.meta.glob (including its `base` option) are all checked against the same layer table.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Anchored to this file, not to ESLint's cwd, so the rule works from any working directory.
const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC_ROOT = path.join(PROJECT_ROOT, 'src');
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;
const GLOB_CHARS = /[*?{[]/;

/**
 * Layers and what each may import (feature modules may additionally import themselves).
 * @type {Record<string, { allowed: string[] }>}
 */
const LAYERS = {
  // Shared test helpers (src/test): may use everything, but only *.test.* files may import them.
  test: { allowed: ['test', 'app', 'modules', 'module-registry', 'platform', 'components', 'lib'] },
  app: { allowed: ['app', 'modules', 'module-registry', 'platform', 'components', 'lib'] },
  'module-registry': { allowed: ['module-registry', 'modules', 'platform', 'components', 'lib'] },
  module: { allowed: ['platform', 'components', 'lib'] },
  platform: { allowed: ['platform', 'components', 'lib'] },
  components: { allowed: ['components', 'lib'] },
  lib: { allowed: ['lib'] },
};

/** @type {Record<string, string>} */
const LAYER_LABEL = {
  test: 'the shared test helpers',
  app: 'the app shell',
  'module-registry': 'the module registry',
  modules: 'another feature module',
  platform: 'the platform layer',
  components: 'shared components',
  lib: 'lib/i18n/types/styles',
};

const REGISTRY_FILE = /^(?:registry|index)(?:\.[cm]?[jt]sx?)?$|\.[cm]?[jt]sx?$/;

/**
 * Classifies a path relative to src/ into a layer. Paths outside src/ return undefined; unknown
 * locations inside src/ return 'unknown' (fail closed: a new top-level folder needs a layer first).
 * @param {string} rel posix path relative to src/
 * @returns {{ layer: string, module?: string } | undefined}
 */
function classify(rel) {
  if (rel.startsWith('..') || path.posix.isAbsolute(rel)) return undefined;
  const [top, second] = rel.split('/');
  switch (top) {
    case 'test':
      return { layer: 'test' };
    case 'app':
    case 'main.tsx':
      return { layer: 'app' };
    case 'modules':
      // src/modules itself and the files directly in it (registry.ts, index.ts) wire modules
      // together; every subdirectory is one feature module.
      return second === undefined || REGISTRY_FILE.test(second)
        ? { layer: 'module-registry' }
        : { layer: 'module', module: second };
    case 'platform':
      return { layer: 'platform' };
    case 'components':
      return { layer: 'components' };
    case 'lib':
    case 'i18n':
    case 'types':
    case 'styles':
      return { layer: 'lib' };
    default:
      return { layer: 'unknown' };
  }
}

/** @type {import('eslint').Rule.RuleModule} */
const layersRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Enforce the layer architecture and module isolation below src/.' },
    schema: [],
    messages: {
      forbidden: 'Imports from {{target}} are not allowed in {{source}}. {{hint}}',
      parentPath: 'Import code outside the current directory via the "@/" alias, not "..".',
      dynamicPath:
        'Dynamic imports must use a string literal path so the architecture can be checked.',
      unknownLocation:
        '"{{path}}" is not in a known layer of src/. Add the folder to config/eslint-plugin-teampanel.js first.',
      globTooBroad: 'import.meta.glob patterns must start inside a concrete folder below src/.',
      testOnly: 'Shared test helpers (src/test) may only be imported by *.test.* files.',
    },
  },
  create(context) {
    const fileRel = toSrcRelative(context.filename);
    const from = classify(fileRel);
    if (from === undefined) return {};
    const isTestFile = TEST_FILE.test(context.filename);

    /**
     * Resolves a local specifier to an absolute path.
     * @param {string} specifier
     * @param {string} [base] absolute directory for relative glob patterns
     */
    function resolveSpecifier(specifier, base) {
      if (specifier.startsWith('@/')) return path.join(SRC_ROOT, specifier.slice(2));
      if (specifier.startsWith('/')) return path.join(PROJECT_ROOT, specifier);
      return path.resolve(base ?? path.dirname(context.filename), specifier);
    }

    /**
     * @param {string} specifier
     * @param {import('estree').Node} node
     * @param {string} [base]
     */
    function check(specifier, node, base) {
      const isLocal =
        specifier.startsWith('.') || specifier.startsWith('@/') || specifier.startsWith('/');
      if (!isLocal && base === undefined) return; // package import

      if (/(?:^|\/)\.\.(?:\/|$)/.test(specifier)) {
        context.report({ node, messageId: 'parentPath' });
      }

      const targetRel = toSrcRelative(resolveSpecifier(specifier, base));
      const to = classify(targetRel);
      if (to === undefined || from === undefined) return;
      if (to.layer === 'unknown') {
        context.report({ node, messageId: 'unknownLocation', data: { path: `src/${targetRel}` } });
        return;
      }
      if (to.layer === 'test') {
        if (from.layer !== 'test' && !isTestFile) context.report({ node, messageId: 'testOnly' });
        return;
      }

      const rules = LAYERS[from.layer];
      if (rules === undefined) return;
      const sameModule =
        to.layer === 'module' && from.layer === 'module' && to.module === from.module;
      if (sameModule) return;
      const targetLayer = to.layer === 'module' ? 'modules' : to.layer;
      if (rules.allowed.includes(targetLayer)) return;

      const hint =
        from.layer === 'module' && to.layer === 'module'
          ? 'Feature modules must not import other feature modules; move shared code to src/platform.'
          : 'See docs/architecture/architektur.md §14.';
      context.report({
        node,
        messageId: 'forbidden',
        data: {
          target: LAYER_LABEL[targetLayer] ?? targetLayer,
          source:
            from.layer === 'module'
              ? `feature module "${from.module ?? ''}"`
              : (LAYER_LABEL[from.layer] ?? from.layer),
          hint,
        },
      });
    }

    /**
     * @param {import('estree').Node | null | undefined} source
     * @param {import('estree').Node} node
     */
    function checkSource(source, node) {
      if (source?.type === 'Literal' && typeof source.value === 'string') {
        check(source.value, node);
      }
    }

    /**
     * import.meta.glob(pattern | pattern[], { base?, … })
     * @param {import('estree').CallExpression} node
     */
    function checkGlob(node) {
      const [patterns, options] = node.arguments;

      /** @type {string | undefined} */
      let base;
      if (options?.type === 'ObjectExpression') {
        for (const property of options.properties) {
          if (
            property.type === 'Property' &&
            property.key.type === 'Identifier' &&
            property.key.name === 'base'
          ) {
            if (property.value.type !== 'Literal' || typeof property.value.value !== 'string') {
              context.report({ node, messageId: 'dynamicPath' });
              return;
            }
            base = resolveSpecifier(property.value.value);
          }
        }
      } else if (options !== undefined) {
        context.report({ node, messageId: 'dynamicPath' });
        return;
      }

      const list = patterns?.type === 'ArrayExpression' ? patterns.elements : [patterns];
      for (const pattern of list) {
        if (pattern?.type !== 'Literal' || typeof pattern.value !== 'string') {
          context.report({ node, messageId: 'dynamicPath' });
          continue;
        }
        // Check the literal directory prefix before the first glob character.
        const raw = pattern.value.replace(/^!/, '');
        const globAt = raw.search(GLOB_CHARS);
        const literal = globAt === -1 ? raw : raw.slice(0, globAt);
        const prefix = literal.slice(0, literal.lastIndexOf('/') + 1) || './';
        const prefixRel = toSrcRelative(resolveSpecifier(prefix, base));
        if (prefixRel === '' || prefixRel.startsWith('..')) {
          context.report({ node, messageId: 'globTooBroad' });
          continue;
        }
        check(prefix, node, base);
      }
    }

    return {
      Program(node) {
        if (from.layer === 'unknown') {
          context.report({ node, messageId: 'unknownLocation', data: { path: `src/${fileRel}` } });
        }
      },
      ImportDeclaration(node) {
        checkSource(node.source, node);
      },
      ExportNamedDeclaration(node) {
        checkSource(node.source, node);
      },
      ExportAllDeclaration(node) {
        checkSource(node.source, node);
      },
      ImportExpression(node) {
        if (node.source.type === 'Literal') checkSource(node.source, node);
        else if (node.source.type === 'TemplateLiteral' && node.source.expressions.length === 0) {
          check(node.source.quasis[0]?.value.cooked ?? '', node);
        } else context.report({ node, messageId: 'dynamicPath' });
      },
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type === 'MemberExpression' &&
          callee.object.type === 'MetaProperty' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'glob'
        ) {
          checkGlob(node);
        }
      },
    };
  },
};

/**
 * @param {string} absolutePath
 * @returns {string} posix path relative to src/
 */
function toSrcRelative(absolutePath) {
  return path.relative(SRC_ROOT, absolutePath).split(path.sep).join('/');
}

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  meta: { name: 'eslint-plugin-teampanel' },
  rules: { layers: layersRule },
};

export default plugin;
