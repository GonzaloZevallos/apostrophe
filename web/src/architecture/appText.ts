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
 * - the first argument of `Intl.NumberFormat`;
 * - anything inside the index of an element access, a lookup that shows nothing;
 * - the default of a destructured code-valued property (`tono = 'neutro'`);
 * - the initializer of a declaration annotated with a string-literal union type (or an array,
 *   set or record of one) declared in the same file;
 * - the operand of `in` and the value assigned to a `style` property;
 * - an argument of a call in `NON_VISIBLE_CALLEES` (the API helpers' paths, DOM and storage
 *   names, an `Error`'s message, which no screen reads: ADR-0008) and of `super(...)`;
 * - the value of an object property in `CODE_VALUED_PROPERTIES` (`status`, `rule`, `tone`...);
 * - the initializer of a declaration whose name says it is a code (`CODE_NAME`: `*_CLASS`,
 *   `*_KEY`, `*_PATH`, `*_ID`...);
 * - a lowercase, space-free token inside an `as const` tuple or object (a code table); a capitalised
 *   or spaced word there is shown text and is still flagged;
 * - a value returned by a function whose declared return type is a union of string
 *   literals, or a local alias of one.
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
  'mode',
  'slug',
  // SVG geometry and the ARIA states with a fixed value: neither is a word.
  'd',
  'viewBox',
  'fill',
  'stroke',
  'strokeLinecap',
  'strokeLinejoin',
  'xmlns',
  'aria-hidden',
  'aria-modal',
  'aria-busy',
  'aria-current',
  'aria-live',
  'aria-atomic',
  'aria-checked',
  'aria-pressed',
  'aria-expanded',
  'aria-haspopup',
  'aria-orientation',
]

/** Calls whose arguments are a path, a name or a developer message, never a shown text. The
 * API helpers take a path; the DOM, event and storage methods take a name; `Error` and
 * `super` (an `Error` subclass) take a message the front never shows (ADR-0008). */
export const NON_VISIBLE_CALLEES: readonly string[] = [
  'get',
  'post',
  'patch',
  'put',
  'del',
  'send',
  'encodeURIComponent',
  'Error',
  'addEventListener',
  'removeEventListener',
  'setAttribute',
  'removeAttribute',
  'getAttribute',
  'setProperty',
  'removeProperty',
  'getPropertyValue',
  'getElementById',
  'querySelector',
  'createElement',
  'execCommand',
  'getItem',
  'setItem',
  'removeItem',
  'register',
  'getAll',
  'matchMedia',
  'stubGlobal',
]

/** Object properties whose value is a code, a state or a table key, never a text. A property
 * that carries a text (`label`, `title`, `message`) is not here. */
export const CODE_VALUED_PROPERTIES: readonly string[] = [
  'status',
  'type',
  'kind',
  'rule',
  'tone',
  'field',
  'placement',
  'group',
  'place',
  'icono',
  'tono',
  'value',
  'to',
  'block',
  'credentials',
  'Accept',
  'Content-Type',
]

/** A declaration named like this holds a code: a class list, a key, a path, a selector, an
 * id. */
/** A lowercase token with no space: the shape of a code in a table, never of a shown word. */
const CODE_SHAPE = /^[a-z0-9_.:/#-]+$/

const CODE_NAME =
  /(?:^|_)(?:CLASS|CLASSES|KEY|PATH|QUERY|SELECTOR|ATTRIBUTE|FIELDS|CONTAINERS|NAMES|PREFIX|ID|IDS|CODE|VIEWPORT)$|(?:Class|Classes|Key|Path|Query|Selector|Attribute|Id|Ids|Code|Viewport)$/

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
      node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
      node.operatorToken.kind === ts.SyntaxKind.InKeyword)
  )
}

function calleeName(expression: ts.Expression): string | null {
  if (ts.isIdentifier(expression)) return expression.text
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text
  return null
}

function propertyKey(name: ts.PropertyName): string | null {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : null
}

/** Whether a left-hand side is some `….style.x`, an inline style value. */
function isStyleTarget(expression: ts.Expression): boolean {
  return (
    ts.isPropertyAccessExpression(expression) &&
    ts.isPropertyAccessExpression(expression.expression) &&
    expression.expression.name.text === 'style'
  )
}

/** Whether a type is a union of string literals, directly or through a local alias. */
function isCodeType(type: ts.TypeNode | undefined, file: ts.SourceFile): boolean {
  if (type === undefined) return false
  if (ts.isParenthesizedTypeNode(type)) return isCodeType(type.type, file)
  if (ts.isLiteralTypeNode(type)) return true
  if (ts.isUnionTypeNode(type)) return type.types.every((member) => isCodeType(member, file))
  if (ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName)) {
    const name = type.typeName.text
    const alias = file.statements.find((statement) => ts.isTypeAliasDeclaration(statement) && statement.name.text === name)
    return alias !== undefined && ts.isTypeAliasDeclaration(alias) && isCodeType(alias.type, file)
  }
  return false
}

/** Whether a value type bottoms out in string literals: a code type, or an array, set, record
 * or promise of one. */
function isCodeValued(type: ts.TypeNode | undefined, file: ts.SourceFile): boolean {
  if (type === undefined) return false
  if (ts.isArrayTypeNode(type)) return isCodeValued(type.elementType, file)
  if (ts.isTypeOperatorNode(type)) return isCodeValued(type.type, file)
  if (ts.isTypeReferenceNode(type) && type.typeArguments !== undefined && type.typeArguments.length > 0) {
    return isCodeValued(type.typeArguments[type.typeArguments.length - 1], file)
  }
  return isCodeType(type, file)
}

function enclosingFunction(node: ts.Node): ts.SignatureDeclaration | undefined {
  for (let current: ts.Node | undefined = node; current !== undefined; current = current.parent) {
    if (ts.isFunctionLike(current)) return current
  }
  return undefined
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
    if (ts.isCallExpression(current) || ts.isNewExpression(current)) {
      const name = calleeName(current.expression)
      const isArgument = child !== current.expression
      if (isArgument && (current.expression.kind === ts.SyntaxKind.SuperKeyword || (name !== null && NON_VISIBLE_CALLEES.includes(name)))) {
        return true
      }
    }
    if (
      ts.isAsExpression(current) &&
      ts.isTypeReferenceNode(current.type) &&
      current.type.typeName.getText() === 'const' &&
      CODE_SHAPE.test(literalOf(node)?.text ?? '')
    ) {
      return true
    }
    if (ts.isPropertyAssignment(current) && current.initializer === child) {
      const key = propertyKey(current.name)
      if (key !== null && CODE_VALUED_PROPERTIES.includes(key)) return true
    }
    if (ts.isVariableDeclaration(current) && current.initializer === child) {
      if (ts.isIdentifier(current.name) && CODE_NAME.test(current.name.text)) return true
      if (isCodeValued(current.type, node.getSourceFile())) return true
    }
    if (ts.isBindingElement(current) && current.initializer === child && ts.isIdentifier(current.name)) {
      if (CODE_VALUED_PROPERTIES.includes(current.name.text)) return true
    }
    if (ts.isElementAccessExpression(current) && current.argumentExpression === child) return true
    if (ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.EqualsToken && current.right === child && isStyleTarget(current.left)) {
      return true
    }
    if (ts.isReturnStatement(current) || (ts.isArrowFunction(current) && current.body === child)) {
      const owner = enclosingFunction(current)
      if (owner !== undefined && isCodeValued(owner.type, node.getSourceFile())) return true
    }
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
