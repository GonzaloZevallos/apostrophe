/**
 * The guard of the back control (GH-135, ADR-0041): one component draws "‹ <parent>"
 * (`components/BackButton.tsx`), and only the shell and Análisis's "Volver" may import it.
 * Fed a module's path and source, `checkBackControl` returns one line per offence, empty
 * when the module is clean. `backControl.test.ts` feeds it what it must reject before
 * `backControl.real.test.ts` runs it over the real tree.
 *
 * Outside `shell/` (test files and the component itself aside) it flags:
 * - any string literal, template part or JSX text holding "‹", except text that is exactly
 *   "‹" inside a `<button>` named by its own `aria-label` other than "Volver" (the month
 *   arrows of Análisis and Gastos);
 * - any import, dynamic import or re-export of `components/BackButton`, unless the module is
 *   in `BACK_BUTTON_IMPORTERS`, the closed set, keyed by path and never by line.
 *
 * Comments are not text, so the AST skips them. It reads the AST, not a regex, so a glyph
 * glued with `+`, in a template or handed to a helper's `label` prop is the same offence.
 */

import * as ts from 'typescript'

const BACK_GLYPH = '‹'

/** The modules outside `shell/` that may import `BackButton`: the tab root's "Volver" to Más. */
export const BACK_BUTTON_IMPORTERS: readonly string[] = ['screens/Analisis.tsx']

/** The module that defines the glyph and the button. */
const BACK_BUTTON_MODULE = 'components/BackButton.tsx'

/** The aria-label of a bare "‹" that is a back control, never a month arrow. */
const BACK_LABEL = 'Volver'

function normalise(path: string): string {
  return path.replaceAll('\\', '/')
}

function under(path: string, directory: string): boolean {
  return path.startsWith(`${directory}/`) || path.includes(`/${directory}/`)
}

function endsWithPath(path: string, tail: string): boolean {
  return path === tail || path.endsWith(`/${tail}`)
}

function isTestSide(path: string): boolean {
  return /\.test\.tsx?$/.test(path) || under(path, 'architecture') || under(path, 'test')
}

function importsBackButton(specifier: string): boolean {
  return /(^|\/)BackButton(\.tsx?)?$/.test(specifier)
}

function isTextNode(node: ts.Node): node is ts.StringLiteral | ts.TemplateLiteralLikeNode | ts.JsxText {
  return (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateHead(node) ||
    ts.isTemplateMiddle(node) ||
    ts.isTemplateTail(node) ||
    ts.isJsxText(node)
  )
}

/** The string an attribute's value spells, when it is a literal (`"x"` or `{"x"}`). */
function literalValue(attribute: ts.JsxAttribute): string | undefined {
  const value = attribute.initializer
  if (value === undefined) return undefined
  if (ts.isStringLiteral(value)) return value.text
  if (ts.isJsxExpression(value) && value.expression !== undefined) {
    const inner = value.expression
    if (ts.isStringLiteral(inner) || ts.isNoSubstitutionTemplateLiteral(inner)) return inner.text
  }
  return undefined
}

function ariaLabelOf(opening: ts.JsxOpeningElement): string | undefined {
  for (const attribute of opening.attributes.properties) {
    if (ts.isJsxAttribute(attribute) && attribute.name.getText() === 'aria-label') {
      return literalValue(attribute)
    }
  }
  return undefined
}

/** A month arrow: the text is exactly "‹", the element a `<button>` named by its own label. */
function isMonthArrow(node: ts.Node): boolean {
  if (!ts.isJsxText(node) || node.text.trim() !== BACK_GLYPH) return false
  const element = node.parent
  if (!ts.isJsxElement(element) || element.openingElement.tagName.getText() !== 'button') return false
  const label = ariaLabelOf(element.openingElement)
  return label !== undefined && label.trim() !== '' && label !== BACK_LABEL
}

export function checkBackControl(path: string, source: string): string[] {
  const file = normalise(path)
  if (under(file, 'shell') || isTestSide(file) || endsWithPath(file, BACK_BUTTON_MODULE)) return []
  const mayImport = BACK_BUTTON_IMPORTERS.some((allowed) => endsWithPath(file, allowed))
  const tree = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const findings: string[] = []
  const report = (node: ts.Node, message: string) => {
    const { line } = tree.getLineAndCharacterOfPosition(node.getStart(tree))
    findings.push(`${file}:${line + 1}: ${message}`)
  }

  const visit = (node: ts.Node) => {
    if (isTextNode(node) && node.text.includes(BACK_GLYPH) && !isMonthArrow(node)) {
      report(node, `writes "${BACK_GLYPH}" itself, use components/BackButton through the shell`)
    }
    const specifier =
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier !== undefined
        ? node.moduleSpecifier
        : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
          ? node.arguments[0]
          : undefined
    if (
      !mayImport &&
      specifier !== undefined &&
      ts.isStringLiteralLike(specifier) &&
      importsBackButton(specifier.text)
    ) {
      report(node, 'imports components/BackButton, only shell/ and screens/Analisis.tsx may')
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return findings
}
