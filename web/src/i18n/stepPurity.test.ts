/**
 * `step.ts` runs under plain node (scripts/design/comparisons.mjs) and in Playwright, with no
 * Vite: so it, `keyShape.ts` and `resolve.ts` may import nothing at runtime but each other, and
 * may not read `import.meta`. Parsed with the TypeScript compiler API, not matched with a regex.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, test } from 'vitest'

const ALLOWED = ['./resolve.ts', './keyShape.ts']

/** What is wrong with the source of `name`: a value import of anything else, or `import.meta`. */
function purityProblems(name: string, source: string): string[] {
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const problems: string[] = []
  const valueImport = (specifier: string): void => {
    if (!ALLOWED.includes(specifier)) problems.push(`${name}: value import of ${specifier}`)
  }
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause
      const bindings = clause?.namedBindings
      const typeOnly =
        clause !== undefined &&
        (clause.isTypeOnly ||
          (clause.name === undefined &&
            bindings !== undefined &&
            ts.isNamedImports(bindings) &&
            bindings.elements.length > 0 &&
            bindings.elements.every((element) => element.isTypeOnly)))
      if (!typeOnly) valueImport(node.moduleSpecifier.text)
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined && ts.isStringLiteral(node.moduleSpecifier)) {
      if (!node.isTypeOnly) valueImport(node.moduleSpecifier.text)
    } else if (ts.isImportEqualsDeclaration(node) && !node.isTypeOnly) {
      problems.push(`${name}: value import of an import-equals`)
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      problems.push(`${name}: dynamic import`)
    } else if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) {
      problems.push(`${name}: import.meta`)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return problems
}

describe('purityProblems on fixtures', () => {
  test('a value import fails', () => {
    expect(purityProblems('f.ts', "import { x } from './other.ts'")).toEqual(['f.ts: value import of ./other.ts'])
    expect(purityProblems('f.ts', "import x from 'node:fs'")).toEqual(['f.ts: value import of node:fs'])
  })

  test('import type passes', () => {
    expect(purityProblems('f.ts', "import type { X } from './other.ts'")).toEqual([])
  })

  test('import { type X } passes', () => {
    expect(purityProblems('f.ts', "import { type X } from './other.ts'")).toEqual([])
  })

  test('a mixed import fails', () => {
    expect(purityProblems('f.ts', "import { type X, y } from './other.ts'")).toEqual(['f.ts: value import of ./other.ts'])
  })

  test('a value import of resolve.ts or keyShape.ts passes', () => {
    expect(purityProblems('f.ts', "import { a } from './resolve.ts'\nimport { b } from './keyShape.ts'")).toEqual([])
  })

  test('a re-export and a dynamic import fail', () => {
    expect(purityProblems('f.ts', "export { x } from './other.ts'")).toEqual(['f.ts: value import of ./other.ts'])
    expect(purityProblems('f.ts', "const m = import('./other.ts')")).toEqual(['f.ts: dynamic import'])
  })

  test('import.meta fails', () => {
    expect(purityProblems('f.ts', 'export const here = import.meta.dirname')).toEqual(['f.ts: import.meta'])
  })

  test('the word in a string or a comment is not an import', () => {
    expect(purityProblems('f.ts', "// import { x } from './other.ts'\nexport const s = \"import.meta\"")).toEqual([])
  })
})

describe('the real files', () => {
  test('step.ts, keyShape.ts and resolve.ts are pure', () => {
    const problems = ['step.ts', 'keyShape.ts', 'resolve.ts'].flatMap((name) =>
      purityProblems(name, readFileSync(join(import.meta.dirname, name), 'utf8')),
    )
    expect(problems).toEqual([])
  })
})
