// Project ESLint plugin: enforces TeamPanel's layer architecture (docs/architecture/architektur.md §14).
//
// Unlike a regex on the raw import string, the rule resolves every specifier to a path below src/
// first, so tricks like './../x', '@/modules/a/../b', dynamic import() and import.meta.glob are
// all checked against the same layer table.

import path from 'node:path';

/**
 * Layers and what each may import. `ownModule` means: only the importing feature module itself.
 * @type {Record<string, { allowed: string[], ownModule?: boolean }>}
 */
const LAYERS = {
  app: { allowed: ['app', 'modules', 'module-registry', 'platform', 'components', 'lib'] },
  'module-registry': { allowed: ['module-registry', 'modules', 'platform', 'components', 'lib'] },
  module: { allowed: ['platform', 'components', 'lib'], ownModule: true },
  platform: { allowed: ['platform', 'components', 'lib'] },
  components: { allowed: ['components', 'lib'] },
  lib: { allowed: ['lib'] },
};

/** @type {Record<string, string>} */
const LAYER_LABEL = {
  app: 'the app shell',
  'module-registry': 'the module registry',
  modules: 'another feature module',
  platform: 'the platform layer',
  components: 'shared components',
  lib: 'lib/i18n/types/styles',
};

const REGISTRY_FILE = /^(?:registry|index)(?:\.[cm]?[jt]sx?)?$|\.[cm]?[jt]sx?$/;

/**
 * Classifies a path relative to src/ into a layer.
 * @param {string} rel posix path relative to src/
 * @returns {{ layer: string, module?: string } | undefined}
 */
function classify(rel) {
  if (rel.startsWith('..') || path.posix.isAbsolute(rel)) return undefined;
  const [top, second] = rel.split('/');
  switch (top) {
    case 'app':
    case 'test':
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
      return undefined;
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
    },
  },
  create(context) {
    const srcRoot = path.join(context.cwd, 'src');
    const fileRel = path.relative(srcRoot, context.filename).split(path.sep).join('/');
    const from = classify(fileRel);
    if (from === undefined) return {};

    /**
     * @param {string} specifier
     * @param {import('estree').Node} node
     */
    function check(specifier, node) {
      const isRelative = specifier.startsWith('.');
      const isAlias = specifier.startsWith('@/');
      const isRootGlob = specifier.startsWith('/src/');
      if (!isRelative && !isAlias && !isRootGlob) return; // package import

      if (/(?:^|\/)\.\.(?:\/|$)/.test(specifier)) {
        context.report({ node, messageId: 'parentPath' });
      }

      let targetAbs;
      if (isAlias) targetAbs = path.join(srcRoot, specifier.slice(2));
      else if (isRootGlob) targetAbs = path.join(context.cwd, specifier);
      else targetAbs = path.resolve(path.dirname(context.filename), specifier);
      const targetRel = path.relative(srcRoot, targetAbs).split(path.sep).join('/');
      const to = classify(targetRel);
      if (to === undefined || from === undefined) return;

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

    return {
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
        // import.meta.glob('…') / import.meta.glob(['…', '…'])
        const callee = node.callee;
        if (
          callee.type !== 'MemberExpression' ||
          callee.object.type !== 'MetaProperty' ||
          callee.property.type !== 'Identifier' ||
          callee.property.name !== 'glob'
        ) {
          return;
        }
        const [patterns] = node.arguments;
        const list = patterns?.type === 'ArrayExpression' ? patterns.elements : [patterns];
        for (const pattern of list) {
          if (pattern?.type === 'Literal' && typeof pattern.value === 'string') {
            check(pattern.value.replace(/^!/, '').replace(/\*.*$/, ''), node);
          } else {
            context.report({ node, messageId: 'dynamicPath' });
          }
        }
      },
    };
  },
};

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  meta: { name: 'eslint-plugin-teampanel' },
  rules: { layers: layersRule },
};

export default plugin;
