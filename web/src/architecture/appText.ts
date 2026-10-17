/**
 * The visible-literal rule (ADR-0048): a screen or component never writes a text a person
 * reads; it imports it from `web/src/copy/`. `findVisibleLiterals(path, source)` parses one
 * file with the TypeScript compiler's own parser and returns every string literal,
 * no-substitution template, template part or JSX text that contains a Unicode letter,
 * except in a closed list of contexts that are not visible text:
 *
 * - import or export specifiers and dynamic import paths;
 * - type positions (a literal type, a template literal type);
 * - the operands of `===` and `!==` and a `case` label (a comparison reads a value, it
 *   shows nothing);
 * - property names and element-access arguments (`row['kind']`);
 * - the `className` attribute and the class helpers' arguments;
 * - `data-*` attributes;
 * - the props in `NON_VISIBLE_PROPS`;
 * - the first argument of `Intl.NumberFormat`.
 *
 * A context added later is added to this list with its reason, never as a per-file
 * exemption: the only allowance is a text-ledger (`textLeft/<owner>.json`), which only
 * shrinks (`appText.real.test.ts`).
 *
 * The scan reads files and nothing else, so it gives the same verdict on any date.
 */

import ts from 'typescript'

export interface VisibleLiteral {
  line: number
  /** What kind of node it is: the text itself is never repeated here. */
  node: 'string' | 'template' | 'jsx-text'
}

/** Props whose value is a code, a name or a path, never a text a person reads. */
export const NON_VISIBLE_PROPS: readonly string[] = [
  'type',
  'role',
  'id',
  'name',
  'htmlFor',
  'inputMode',
  'enterKeyHint',
  'autoComplete',
  'variant',
  'action',
  'icon',
  'nombre',
  'to',
  'href',
  'textOnly',
  'kind',
]

/** Functions that build a class list: their arguments are class names. */
export const CLASS_HELPERS: readonly string[] = ['classNames', 'cx', 'railClassName']

const LETTER = /\p{L}/u

/** Directories under `web/src` the rule does not read, and why: the section files are where
 * texts live, the architecture folder is the guards and their fixtures, `test/` is test
 * support, `design/` holds the design-evidence tooling. */
const SKIPPED_DIRECTORIES = ['src/copy/', 'src/architecture/', 'src/test/', 'src/design/']

/** Whether the visible-literal rule reads this file: a non-test `.ts`/`.tsx` under
 * `web/src` outside the skipped directories and `routes.ts`. `path` is relative to `web/`,
 * as in `src/screens/Entrar.tsx`. */
export function isScanned(path: string): boolean {
  if (!/\.tsx?$/.test(path) || /\.d\.ts$/.test(path)) return false
  if (!path.startsWith('src/')) return false
  if (/\.test\.tsx?$/.test(path) || /^src\/test-[\w-]+\.ts$/.test(path)) return false
  if (path === 'src/routes.ts') return false
  return !SKIPPED_DIRECTORIES.some((directory) => path.startsWith(directory))
}

function literalOf(node: ts.Node): { kind: VisibleLiteral['node']; text: string } | null {
  if (ts.isStringLiteral(node)) return { kind: 'string', text: node.text }
  if (
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateHead(node) ||
    ts.isTemplateMiddle(node) ||
    ts.isTemplateTail(node)
  ) {
    return { kind: 'template', text: node.text }
  }
  if (ts.isJsxText(node)) return { kind: 'jsx-text', text: node.text }
  return null
}

function attributeName(attribute: ts.JsxAttribute): string {
  return ts.isIdentifier(attribute.name) ? attribute.name.text : `${attribute.name.namespace.text}:${attribute.name.name.text}`
}

function isIntlNumberFormat(expression: ts.Expression): boolean {
  return (
    ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === 'Intl' &&
    expression.name.text === 'NumberFormat'
  )
}

function isClassHelper(expression: ts.Expression): boolean {
  return ts.isIdentifier(expression) && CLASS_HELPERS.includes(expression.text)
}

function isComparison(node: ts.Node): boolean {
  return (
    ts.isBinaryExpression(node) &&
    (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken)
  )
}

/** Whether the literal `node` sits in a context that shows nothing. */
function isAllowedContext(node: ts.Node): boolean {
  const parent = node.parent
  // A comparison operand, a case label, a property name, an element access.
  if (isComparison(parent) || ts.isCaseClause(parent)) return true
  if (ts.isPropertyAssignment(parent) && parent.name === node) return true
  if (ts.isPropertyDeclaration(parent) && parent.name === node) return true
  if (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) return true
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return true
  if (ts.isImportAttribute(parent) || ts.isExternalModuleReference(parent)) return true

  let child: ts.Node = node
  for (let current: ts.Node | undefined = parent; current !== undefined; current = current.parent) {
    if (ts.isTypeNode(current)) return true
    if (ts.isCallExpression(current) && current.expression.kind === ts.SyntaxKind.ImportKeyword) return true
    if (
      (ts.isCallExpression(current) || ts.isNewExpression(current)) &&
      current.arguments !== undefined &&
      isIntlNumberFormat(current.expression) &&
      current.arguments[0] === child
    ) {
      return true
    }
    if (ts.isCallExpression(current) && isClassHelper(current.expression) && child !== current.expression) return true
    if (ts.isJsxAttribute(current)) {
      const name = attributeName(current)
      return name === 'className' || name.startsWith('data-') || NON_VISIBLE_PROPS.includes(name)
    }
    // Under JSX children or a function body the literal is not the attribute's own value.
    if (
      ts.isJsxElement(current) ||
      ts.isJsxFragment(current) ||
      ts.isJsxSelfClosingElement(current) ||
      ts.isFunctionLike(current) ||
      ts.isStatement(current)
    ) {
      return false
    }
    child = current
  }
  return false
}

/** Every visible literal of one source file, in source order. */
export function findVisibleLiterals(path: string, source: string): VisibleLiteral[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.ES2023, true)
  const found: VisibleLiteral[] = []
  const visit = (node: ts.Node): void => {
    const literal = literalOf(node)
    if (literal !== null && LETTER.test(literal.text) && !isAllowedContext(node)) {
      found.push({ line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1, node: literal.kind })
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}
