/**
 * The e2e exact-label rule (GH-734): Playwright's `getByLabel('Name')` matches by substring, so
 * it also resolves to a button whose `aria-label` is `Edit name` while an earlier screen is still
 * up, and a step that fills "the Name field" fills the button. Every `getByLabel` call in
 * `web/e2e/**` must therefore be exact.
 *
 * A call passes only when its first argument is a regex literal (the author chose the match), or
 * its second argument is an object literal with no spread whose last `exact` property is the
 * literal `true`. Everything else is reported: no options, `exact: false`, `exact` from a
 * variable, a spread, options held in a variable or built by a call.
 *
 * There is no allowlist, pending list or per-file exemption. It is a syntactic check of one
 * source: a locator built by a helper in another module (a label passed as a parameter that is
 * then handed to `getByLabel` without `exact`) is reported where `getByLabel` is called, but a
 * locator created outside `web/e2e/` is invisible to it.
 */

import ts from 'typescript'

export interface InexactLabel {
  /** 1-based line of the `getByLabel` call. */
  line: number
  reason: string
}

const REASON =
  "getByLabel's first argument is not a regex literal and its second is not an object literal with `exact: true`"

function isGetByLabel(call: ts.CallExpression): boolean {
  const callee = call.expression
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text === 'getByLabel'
  return ts.isIdentifier(callee) && callee.text === 'getByLabel'
}

function propertyName(property: ts.ObjectLiteralElementLike): string | undefined {
  const name = property.name
  if (name === undefined) return undefined
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined
}

/** True when `options` is an object literal, spread-free, whose last `exact` is the literal `true`. */
function isExactTrue(options: ts.Expression | undefined): boolean {
  if (options === undefined || !ts.isObjectLiteralExpression(options)) return false
  if (options.properties.some(ts.isSpreadAssignment)) return false
  const exact = options.properties.filter((property) => propertyName(property) === 'exact')
  const last = exact[exact.length - 1]
  return last !== undefined && ts.isPropertyAssignment(last) && last.initializer.kind === ts.SyntaxKind.TrueKeyword
}

/** Every `getByLabel` call in one source that is not exact, in reading order. */
export function findInexactLabels(source: string): InexactLabel[] {
  const file = ts.createSourceFile('spec.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const found: InexactLabel[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && isGetByLabel(node)) {
      const [label, options] = node.arguments
      const regex = label !== undefined && ts.isRegularExpressionLiteral(label)
      if (!regex && !isExactTrue(options)) {
        found.push({ line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1, reason: REASON })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}
