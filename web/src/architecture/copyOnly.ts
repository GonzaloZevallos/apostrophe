/**
 * The copy-only guard (GH-53, ADR-0049): a screen, the shell or a component holds no text a
 * person reads; it reads a key of `web/src/copy/`. `findCopyLiterals` reads one `.tsx` source
 * with the TypeScript parser, so a comment, a type, a `className` or a route never counts, and
 * reports each place that writes visible text outright:
 *
 * - JSX text with a letter or a digit in it (`<p>Hola</p>`);
 * - a string literal in a JSX expression child (`<p>{'Hola'}</p>`);
 * - a string or template `aria-label`, `title`, `placeholder`, `alt` or `aria-valuetext`
 *   attribute, written as `title="Hola"`, `title={'Hola'}` or a template with no hole.
 *
 * `findCopyImports` reads the other half of the rule: which files of `web/src/copy/` a source
 * imports, so the files that still import words (not keys) can be listed (`i18nOffenders/`).
 *
 * It is a ratchet, not a proof: a text built by a helper in another module, or a literal
 * assigned to a variable and rendered later, is invisible to it (ADR-0049 lists the limits).
 */

import ts from 'typescript'

export { SCANNED } from './i18nOffenders/scan'

export const TEXT_ATTRIBUTES = ['aria-label', 'title', 'placeholder', 'alt', 'aria-valuetext'] as const

const READABLE = /[\p{L}\p{N}]/u

export interface CopyLiteral {
  line: number
  kind: 'jsx-text' | 'jsx-string' | 'attribute'
  text: string
}

function isLiteralText(node: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
}

/** The text an attribute writes outright, or undefined when it reads a variable or a key. */
function attributeText(initializer: ts.JsxAttributeValue | undefined): string | undefined {
  if (initializer === undefined) return undefined
  if (ts.isStringLiteral(initializer)) return initializer.text
  if (!ts.isJsxExpression(initializer) || initializer.expression === undefined) return undefined
  const { expression } = initializer
  return isLiteralText(expression) ? expression.text : undefined
}

/** Every visible literal in `source` (a `.tsx` file), in reading order. */
export function findCopyLiterals(source: string): CopyLiteral[] {
  const file = ts.createSourceFile('source.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: CopyLiteral[] = []
  const add = (node: ts.Node, kind: CopyLiteral['kind'], text: string): void => {
    if (!READABLE.test(text)) return
    found.push({ line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1, kind, text: text.trim() })
  }
  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      add(node, 'jsx-text', node.text)
    } else if (ts.isJsxExpression(node) && node.expression !== undefined && isLiteralText(node.expression)) {
      if (!ts.isJsxAttribute(node.parent)) add(node, 'jsx-string', node.expression.text)
    } else if (ts.isJsxAttribute(node) && (TEXT_ATTRIBUTES as readonly string[]).includes(node.name.getText(file))) {
      const text = attributeText(node.initializer)
      if (text !== undefined) add(node, 'attribute', text)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}

export interface CopyImport {
  /** The copy file, as `sales.ts`. */
  copyFile: string
  /** The exported names the source takes (`default` for a default import), or `'*'` for the whole module. */
  names: string[] | '*'
}

/** A specifier that ends in `copy/<name>`, with an optional `.ts`: not `copy/locales/...`, not a `.json`. */
const COPY_SPECIFIER = /(?:^|\/)copy\/([A-Za-z0-9_]+)(?:\.ts)?$/

function copyFileOf(specifier: ts.Node | undefined): string | undefined {
  if (specifier === undefined || !isLiteralText(specifier)) return undefined
  const name = COPY_SPECIFIER.exec(specifier.text)?.[1]
  return name === undefined ? undefined : `${name}.ts`
}

/** The names a list of specifiers takes, leaving out the `type` ones. */
function valueNames(elements: ts.NodeArray<ts.ImportSpecifier | ts.ExportSpecifier>): string[] {
  return elements.filter((element) => !element.isTypeOnly).map((element) => (element.propertyName ?? element.name).text)
}

/**
 * Every import of a `copy/<name>` file in `source` (`kind`: `ts` or `tsx`), in reading order:
 * `import { A }`, `import D`, `import * as S`, `export { A } from`, `export * from` and a dynamic
 * `import('...')` with a literal argument. A type-only import or re-export, whole or by specifier,
 * brings no text and is left out, as is a side-effect import.
 */
export function findCopyImports(source: string, kind: 'ts' | 'tsx'): CopyImport[] {
  const tsx = kind === 'tsx'
  const file = ts.createSourceFile(tsx ? 'source.tsx' : 'source.ts', source, ts.ScriptTarget.Latest, true, tsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const found: CopyImport[] = []
  const add = (copyFile: string | undefined, names: string[] | '*'): void => {
    if (copyFile !== undefined && (names === '*' || names.length > 0)) found.push({ copyFile, names })
  }
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause
      if (clause !== undefined && !clause.isTypeOnly) {
        const bindings = clause.namedBindings
        if (bindings !== undefined && ts.isNamespaceImport(bindings)) add(copyFileOf(node.moduleSpecifier), '*')
        else {
          const named = bindings === undefined ? [] : valueNames(bindings.elements)
          add(copyFileOf(node.moduleSpecifier), clause.name === undefined ? named : ['default', ...named])
        }
      }
    } else if (ts.isExportDeclaration(node) && !node.isTypeOnly) {
      const clause = node.exportClause
      const names = clause === undefined || ts.isNamespaceExport(clause) ? '*' : valueNames(clause.elements)
      add(copyFileOf(node.moduleSpecifier), names)
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      add(copyFileOf(node.arguments[0]), '*')
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}
