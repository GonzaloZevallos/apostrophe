/**
 * Invariant 9 over `web/src/copy/`: a word two sections show is defined once, in the
 * section that owns it, and the other sections import it read-only. The scan parses each
 * section as source and reports every string literal that more than one file spells out;
 * an import is not a literal, so a section that re-exports a shared constant passes.
 *
 * Skipped, because they are not shown words: import and export paths, property names,
 * type positions, and the `reason` of a SAME_IN_BOTH entry and the `kind` of a limit.
 */

import ts from 'typescript'

export interface CopySource {
  path: string
  source: string
}

/** The static strings one file spells out, NFC-normalised and trimmed. Case is kept: "hidden"
 * on a pill and "Hidden" on a title are two texts, not one word twice. */
export function spelledOut(path: string, source: string): Set<string> {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const found = new Set<string>()
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isTypeNode(node)) return
    if (ts.isPropertyAssignment(node) && ['reason', 'kind'].includes(node.name.getText(file))) return
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const parent = node.parent
      const isName =
        ts.isComputedPropertyName(parent) ||
        ((ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent)) && parent.name === node)
      const text = node.text.normalize('NFC').trim()
      if (!isName && /\p{L}/u.test(text)) found.add(text)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}

/** One line per text that two or more of `sources` spell out; empty when each has one home. */
export function sharedProblems(sources: readonly CopySource[]): string[] {
  const owners = new Map<string, string[]>()
  for (const { path, source } of sources) {
    for (const text of spelledOut(path, source)) owners.set(text, [...(owners.get(text) ?? []), path])
  }
  return [...owners]
    .filter(([, paths]) => paths.length > 1)
    .map(([text, paths]) => `"${text}" is defined in ${paths.join(' and ')}: import it from one owner`)
}
