/**
 * The pieces `Variedades` hands the Products layouts (`screens/varieties/ProductsComputer`,
 * `ProductsBody` and the blocks they render) are leaves: they draw what `Variedades` read and decided.
 *
 *   1. They import no value from `screens/Variedades` (only `import type`): `Variedades` imports
 *      them, so a value coming back would be a runtime cycle;
 *   2. they import no `api/*` module: the queries stay in `Variedades`.
 *
 * Only the named files are scanned: the other files of the folder (`ThresholdForm`, `PriceForm`,
 * `varietyForms`, ...) import values from `Variedades` and stay as they are.
 */

export interface Source {
  path: string
  content: string
}

/** The files this rule covers. A new piece of the Products layouts is listed here. */
export const PRODUCTS_FILES = [
  'src/screens/varieties/ProductsBody.tsx',
  'src/screens/varieties/ProductsComputer.tsx',
  'src/screens/varieties/ProductsPhone.tsx',
  'src/screens/varieties/VarietyRows.tsx',
  'src/screens/varieties/SendCatalog.tsx',
  'src/screens/varieties/StockActions.tsx',
  'src/screens/varieties/ProductsSummary.tsx',
  'src/screens/varieties/ProductsEmpty.tsx',
]

const TYPE_ONLY = /^import\s+type\b/
/** `import x from 'm'`, `import 'm'` at a line start, or `import('m')` anywhere. */
const IMPORT = /(^[ \t]*import\s+(?:type\s+)?(?:[^'";]*?\sfrom\s+)?|\bimport\s*\(\s*)['"]([^'"]+)['"]/gm

function line(content: string, index: number): number {
  return content.slice(0, index).split('\n').length
}

/** One line per offence, `path:line: reason`. */
export function findProductsFileImports(files: Source[]): string[] {
  const out: string[] = []
  for (const { path, content } of files) {
    if (!PRODUCTS_FILES.includes(path)) continue
    for (const match of content.matchAll(IMPORT)) {
      const module = match[2] ?? ''
      const text = match[0].trimStart()
      const at = line(content, match.index ?? 0)
      if (/(?:^|\/)Variedades$/.test(module) && !TYPE_ONLY.test(text)) {
        out.push(`${path}:${at}: imports a value from screens/Variedades; only \`import type\` is allowed`)
      }
      const api = /(?:^|\/)api\/([^/]+)$/.exec(module)
      if (api !== null) out.push(`${path}:${at}: imports api/${api[1] ?? ''}; the screen reads, this file only draws`)
    }
  }
  return out
}
