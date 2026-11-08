/**
 * The no-top-level-text guard (GH-379, ADR-0049 amendment): the product's words are resolved
 * when a function runs, never when a module loads, because the language can change after the
 * load. `findTopLevelText` reads one source with the TypeScript parser (no regexp on the
 * source) and reports three rules, each as `{ line, rule }`:
 *
 * - `t-outside-function`: `t(`, `i18n.t(` or `i18next.t(` at module scope, or an alias of `t`
 *   taken there (`const tt = i18next.t`, `const { t } = i18n`). Aliases are banned, not followed.
 * - `locale-import`: a file outside `src/i18n/` that imports, re-exports or globs `locales/`,
 *   or does so through an `import()` or a glob it cannot prove literal. Types are allowed.
 * - `resource-read`: at module scope, a call to `getResource`, `getResourceBundle`,
 *   `getFixedT` or `resolveKey`, `.store` or `.services` on `i18n`/`i18next`, or a property
 *   or element access on a binding imported from a locale JSON file or `i18n/englishStatic`.
 *   Passing such a binding on by reference is not a read.
 *
 * Inside a function is the body of a function declaration or expression, an arrow, a method, an
 * accessor (object getters and setters too) or a constructor. Module scope is everything else:
 * class field initialisers, `static {}` blocks, default parameters, decorators, the arguments of
 * a call made at module scope, and the body of an IIFE. A default parameter belongs to the scope
 * that declares the function, so `function f(t, x = t('a'))` at module scope is a finding: a known
 * false positive. `require()` is not covered, because `src/` is ESM only.
 */

import ts from 'typescript'

export type TopLevelRule = 't-outside-function' | 'locale-import' | 'resource-read'

export interface TopLevelFinding {
  line: number
  rule: TopLevelRule
}

/** The module whose bindings are the English locale JSON in memory: reading one at load is a
 * resource read as much as reading the JSON file's own import. Compared by file name, so every
 * relative path to it counts. */
export const ENGLISH_STATIC_MODULE = 'englishStatic'

/** The one file the `t-outside-function` rule lets alone, and why. It is a single constant, never
 * a list, compared with `===` against the path normalised to start at `src/`. */
export const I18N_EXCEPTION: { readonly path: string; readonly reason: string } = {
  path: 'src/i18n/testing.ts',
  reason:
    '`testT = i18n.t` hands a test the instance\'s `t` for helpers that take `t` from their caller; ' +
    'it is a test helper that no screen imports, and the instance it reads is the one every test already shares.',
}

const LOCALES_DIR = 'locales/'
const I18N_OBJECTS: readonly string[] = ['i18n', 'i18next']
const RESOURCE_CALLS: readonly string[] = ['getResource', 'getResourceBundle', 'getFixedT', 'resolveKey']
const RESOURCE_MEMBERS: readonly string[] = ['store', 'services']

/** `path` normalised to start at `src/`, with `/` separators. */
function fromSrc(path: string): string {
  const slashed = `/${path.split('\\').join('/')}`
  const at = slashed.indexOf('/src/')
  return at < 0 ? slashed.slice(1) : slashed.slice(at + 1)
}

/** The one place that may import `locales/`. */
function isInsideI18n(path: string): boolean {
  return fromSrc(path).startsWith('src/i18n/')
}

function isStringLike(node: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
}

/** The strings an argument spells outright (a literal, a template with no hole, or an array of
 * only those), or undefined when it is anything else. */
function literalStrings(node: ts.Node | undefined): string[] | undefined {
  if (node === undefined) return undefined
  if (isStringLike(node)) return [node.text]
  if (!ts.isArrayLiteralExpression(node)) return undefined
  const strings: string[] = []
  for (const element of node.elements) {
    if (!isStringLike(element)) return undefined
    strings.push(element.text)
  }
  return strings
}

function isFunctionScope(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isConstructorDeclaration(node)
  )
}

/** The function is written as the callee of a call: `(() => {...})()`, so its body runs now. */
function isCalledInPlace(node: ts.Node): boolean {
  let current = node
  while (ts.isParenthesizedExpression(current.parent)) current = current.parent
  return ts.isCallExpression(current.parent) && current.parent.expression === current
}

function isNamed(node: ts.Node, names: readonly string[]): boolean {
  return ts.isIdentifier(node) && names.includes(node.text)
}

/** `i18n.t` or `i18next.t`. */
function isI18nT(node: ts.Node): node is ts.PropertyAccessExpression {
  return ts.isPropertyAccessExpression(node) && node.name.text === 't' && isNamed(node.expression, I18N_OBJECTS)
}

/** The name an access spells (`a.b` or `a['b']`), or undefined for a computed one. */
function memberName(node: ts.PropertyAccessExpression | ts.ElementAccessExpression): string | undefined {
  if (ts.isPropertyAccessExpression(node)) return node.name.text
  return isStringLike(node.argumentExpression) ? node.argumentExpression.text : undefined
}

function importedBindings(file: ts.SourceFile): Set<string> {
  const names = new Set<string>()
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
    const clause = statement.importClause
    if (clause === undefined || clause.isTypeOnly) continue
    const specifier = statement.moduleSpecifier.text
    const base = specifier.slice(specifier.lastIndexOf('/') + 1)
    const isLocaleJson = specifier.includes(LOCALES_DIR) && specifier.endsWith('.json')
    const isEnglishStatic = [ENGLISH_STATIC_MODULE, `${ENGLISH_STATIC_MODULE}.ts`, `${ENGLISH_STATIC_MODULE}.js`].includes(base)
    if (!isLocaleJson && !isEnglishStatic) continue
    if (clause.name !== undefined) names.add(clause.name.text)
    const bindings = clause.namedBindings
    if (bindings === undefined) continue
    if (ts.isNamespaceImport(bindings)) names.add(bindings.name.text)
    else for (const element of bindings.elements) if (!element.isTypeOnly) names.add(element.name.text)
  }
  return names
}

/** Every module-scope text read and every locale import in `source`, sorted by line. `path`
 * decides the `.ts` or `.tsx` parse and whether the file sits in `src/i18n/`. */
export function findTopLevelText(path: string, source: string): TopLevelFinding[] {
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, kind)
  const mayImportLocales = isInsideI18n(path)
  const bindings = importedBindings(file)
  const seen = new Set<string>()
  const found: TopLevelFinding[] = []
  const add = (node: ts.Node, rule: TopLevelRule): void => {
    const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1
    if (seen.has(`${line}:${rule}`)) return
    seen.add(`${line}:${rule}`)
    found.push({ line, rule })
  }

  const isLocaleSpecifier = (node: ts.Expression | undefined): boolean =>
    node !== undefined && ts.isStringLiteral(node) && node.text.includes(LOCALES_DIR)

  /** An `import()` or `import.meta.glob()` that reaches `locales/`, or may. */
  const reachesLocales = (call: ts.CallExpression): boolean => {
    const callee = call.expression
    const isDynamicImport = callee.kind === ts.SyntaxKind.ImportKeyword
    const isGlob =
      ts.isPropertyAccessExpression(callee) &&
      callee.name.text === 'glob' &&
      ts.isMetaProperty(callee.expression) &&
      callee.expression.keywordToken === ts.SyntaxKind.ImportKeyword
    if (!isDynamicImport && !isGlob) return false
    const strings = literalStrings(call.arguments[0])
    return strings === undefined || strings.some((text) => text.includes(LOCALES_DIR))
  }

  const checkModuleScope = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.initializer !== undefined) {
      const { name, initializer } = node
      if (isNamed(initializer, ['t'])) add(node, 't-outside-function')
      if (
        ts.isObjectBindingPattern(name) &&
        isNamed(initializer, I18N_OBJECTS) &&
        name.elements.some((element) => (element.propertyName ?? element.name).getText(file) === 't')
      ) {
        add(node, 't-outside-function')
      }
    } else if (isI18nT(node)) {
      add(node, 't-outside-function')
    } else if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const { expression } = node
      if (!ts.isIdentifier(expression)) return
      const member = memberName(node)
      const isStoreRead = I18N_OBJECTS.includes(expression.text) && member !== undefined && RESOURCE_MEMBERS.includes(member)
      if (isStoreRead || bindings.has(expression.text)) add(node, 'resource-read')
    }
  }

  const visit = (node: ts.Node, inFunction: boolean): void => {
    if (isFunctionScope(node)) {
      const bodyInFunction = inFunction || !isCalledInPlace(node)
      ts.forEachChild(node, (child) => visit(child, child === node.body ? bodyInFunction : inFunction))
      return
    }
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      !mayImportLocales &&
      isLocaleSpecifier(node.moduleSpecifier)
    ) {
      const typeOnly = ts.isImportDeclaration(node) ? node.importClause?.isTypeOnly : node.isTypeOnly
      if (typeOnly !== true) add(node, 'locale-import')
    }
    if (ts.isCallExpression(node)) {
      if (!mayImportLocales && reachesLocales(node)) add(node, 'locale-import')
      if (!inFunction) {
        const callee = node.expression
        const calleeName = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : undefined
        if (calleeName !== undefined && RESOURCE_CALLS.includes(calleeName)) add(node, 'resource-read')
        if (isNamed(callee, ['t']) || isI18nT(callee)) {
          add(node, 't-outside-function')
          for (const argument of node.arguments) visit(argument, inFunction)
          return
        }
      }
    }
    if (!inFunction) checkModuleScope(node)
    ts.forEachChild(node, (child) => visit(child, inFunction))
  }

  visit(file, false)
  const exempt = fromSrc(path) === I18N_EXCEPTION.path
  return found
    .filter(({ rule }) => !(exempt && rule === 't-outside-function'))
    .sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule, 'en'))
}
