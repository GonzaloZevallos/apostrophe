/**
 * The whole-peso writers `formatMoney`, `formatSignedMoney` and `formatMoneyMagnitude` of
 * `format/money.ts` are being replaced by `useMoney()`. `legacyImports` reads one source with the
 * TypeScript parser and names which of the three it imports from the money module, so a test can
 * hold the list of importers to a shrinking set.
 */

import ts from 'typescript'

export const LEGACY_FORMATTERS: readonly string[] = ['formatMoney', 'formatSignedMoney', 'formatMoneyMagnitude']

/** The legacy writers `source` imports from a module named `money` (any relative path to it). */
export function legacyImports(path: string, source: string): string[] {
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, kind)
  const found: string[] = []
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
    const specifier = statement.moduleSpecifier.text
    if (!/(^|\/)money(\.ts)?$/.test(specifier)) continue
    const bindings = statement.importClause?.namedBindings
    if (bindings === undefined || !ts.isNamedImports(bindings)) continue
    for (const element of bindings.elements) {
      const imported = (element.propertyName ?? element.name).text
      if (LEGACY_FORMATTERS.includes(imported)) found.push(imported)
    }
  }
  return found
}
