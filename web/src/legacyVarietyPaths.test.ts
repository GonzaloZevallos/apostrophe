import { describe, expect, test } from 'vitest'

/** The only files allowed to import the quarantine module `legacyVarietyPaths.ts`, by exact
 * path. The migration subtask deletes the module and this scan with it; until then a new
 * importer is a failure, so the per-screen path functions cannot spread. */
const ALLOWED_IMPORTERS: readonly string[] = [
  'src/screens/Catalogo.tsx',
  'src/screens/EntradaStock.tsx',
  'src/screens/EntriesList.tsx',
  'src/screens/Variedades.tsx',
  'src/screens/varieties/PriceHistory.test.tsx',
  'src/screens/varieties/PriceHistory.tsx',
  'src/screens/varieties/PriceNew.test.tsx',
  'src/screens/varieties/PriceNew.tsx',
  'src/screens/varieties/priceScreens.test.ts',
  'src/screens/varieties/renderVarieties.tsx',
  'src/screens/varieties/VarietiesIndex.tsx',
  'src/screens/varieties/VarietyPage.test.tsx',
  'src/screens/varieties/VarietyPage.tsx',
  'src/screens/varieties/VarietyPricesSection.tsx',
  'src/screens/varieties/VarietyStockSection.tsx',
]

interface Source {
  path: string
  content: string
}

/** The files that import the quarantine module and are not on the allowed list. */
function strayImporters(files: Source[], allowed: readonly string[]): string[] {
  return files
    .filter(({ path }) => path !== 'src/legacyVarietyPaths.ts' && path !== 'src/legacyVarietyPaths.test.ts')
    .filter(({ content }) => /from\s+['"][./]*legacyVarietyPaths['"]/.test(content))
    .map(({ path }) => path)
    .filter((path) => !allowed.includes(path))
}

describe('the legacy variety paths quarantine', () => {
  test('refuses an importer that is not on the allowed list', () => {
    const files: Source[] = [
      { path: 'src/screens/New.tsx', content: "import { VARIETY } from '../legacyVarietyPaths'" },
      { path: 'src/screens/Ok.tsx', content: "import { VARIETY } from '../legacyVarietyPaths'" },
      { path: 'src/screens/Other.tsx', content: "import { VARIETY } from '../routes'" },
    ]

    expect(strayImporters(files, ['src/screens/Ok.tsx'])).toEqual(['src/screens/New.tsx'])
  })

  test('the real front sources import it only from the allowed files', () => {
    const modules = import.meta.glob<string>('/src/**/*.{ts,tsx}', {
      query: '?raw',
      import: 'default',
      eager: true,
    })
    const files = Object.entries(modules).map(([path, content]) => ({
      path: path.replace(/^\//, ''),
      content,
    }))

    expect(files.length).toBeGreaterThan(50)
    expect(strayImporters(files, ALLOWED_IMPORTERS)).toEqual([])
  })
})
