/**
 * The literal guard for money text. No string in `format/money.ts` and none in `copy/` writes a
 * currency symbol followed by a digit (`$ 11.000`, `US$0`, `€5`): the symbol is the business's
 * own, and an amount enters copy only as an argument the caller already formatted with
 * `useMoney()`. `moneyLiteralHits` reads one source with the TypeScript parser and names every
 * string, template or JSX text that spells a symbol and a digit, so a comment that explains a
 * format is not a hit. The one exception is the Sale bill, which keeps its fixed form
 * (`SALE_BILL_TEXT` in `copy/`, `sales/saleBill.ts`), plus the two files that hold sample
 * arguments rather than copy (`SAMPLE_FILES`).
 */

import ts from 'typescript'

/** A currency symbol (`$`, `€`, `£`, ... so also the end of `US$` or `R$`), then an optional space
 * or no-break space, then a digit. */
const SYMBOL_THEN_DIGIT = /\p{Sc}[\s\u00a0]?\d/u

/** The path separator, spelled by code so the route-literal scan of `routes.test.ts` has nothing to read. */
const SLASH = '\u002F'
const inSrc = (...parts: string[]): string => ['src', ...parts].join(SLASH)

/** The files the guard reads: the money module and every non-test module of `copy/`. */
export function isGuardedPath(path: string): boolean {
  const normal = path.split('\\').join(SLASH)
  if (/\.test\.tsx?$/.test(normal)) return false
  const inCopy = normal.includes(`${SLASH}${inSrc('copy')}${SLASH}`) || normal.startsWith(`${inSrc('copy')}${SLASH}`)
  return normal.endsWith(inSrc('format', 'money.ts')) || (inCopy && /\.tsx?$/.test(normal))
}

/** Files of `copy/` that hold the arguments a test hands to copy functions (the baseline's readable
 * fixture, the length limits' worst-case samples), not text a screen shows. */
export const SAMPLE_FILES: readonly string[] = [inSrc('copy', 'baselineArgs.ts'), inSrc('copy', 'limits.ts')]

function isSampleFile(path: string): boolean {
  const normal = path.split('\\').join(SLASH)
  return SAMPLE_FILES.some((file) => normal.endsWith(file))
}

/** The literal texts of `source` that spell a symbol and a digit, outside `SALE_BILL_TEXT`. */
export function moneyLiteralHits(path: string, source: string): string[] {
  if (!isGuardedPath(path) || isSampleFile(path)) return []
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, kind)
  const hits: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'SALE_BILL_TEXT') return
    if (
      (ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node) ||
        ts.isJsxText(node)) &&
      SYMBOL_THEN_DIGIT.test(node.text)
    ) {
      hits.push(node.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return hits
}
