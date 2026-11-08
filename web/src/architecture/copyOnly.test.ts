/**
 * `findCopyLiterals` is fed sources it must flag and sources it must pass, with exact counts;
 * then the real `screens/`, `shell/` and `components/` are scanned (ADR-0049, GH-53).
 */

import { describe, expect, test } from 'vitest'
import { findCopyImports, findCopyLiterals, SCANNED, TEXT_ATTRIBUTES } from './copyOnly'
import { isScanned, scannedSources } from './i18nOffenders/scan'

describe('findCopyLiterals', () => {
  test('flags JSX text, a string child and the five text attributes: exactly eight', () => {
    const source = [
      'export function A({ name }: { name: string }) {',
      '  return (',
      '    <section aria-label="Resumen" title={"Detalle"}>',
      '      <p>Hola {name}</p>',
      '      <p>{\'Chau\'}</p>',
      '      <input placeholder={`Buscar`} />',
      '      <b>3 ventas</b>',
      '      <img alt="Foto" />',
      "      <progress aria-valuetext={'3 de 5'} />",
      '    </section>',
      '  )',
      '}',
    ].join('\n')
    expect(findCopyLiterals(source)).toEqual([
      { line: 3, kind: 'attribute', text: 'Resumen' },
      { line: 3, kind: 'attribute', text: 'Detalle' },
      { line: 4, kind: 'jsx-text', text: 'Hola' },
      { line: 5, kind: 'jsx-string', text: 'Chau' },
      { line: 6, kind: 'attribute', text: 'Buscar' },
      { line: 7, kind: 'jsx-text', text: '3 ventas' },
      { line: 8, kind: 'attribute', text: 'Foto' },
      { line: 9, kind: 'attribute', text: '3 de 5' },
    ])
  })

  test('passes copy keys, class names, routes, punctuation and comments: exactly zero', () => {
    const source = [
      "import { SALES_TEXT } from '../copy/sales'",
      '// <p>Hola</p> in a comment',
      'export function B({ label }: { label: string }) {',
      '  /* <b title="Hola" /> */',
      '  return (',
      '    <section aria-label={SALES_TEXT.resumen} title={label} className="resumen total">',
      '      <a href="#top">{SALES_TEXT.hoy}</a>',
      '      <span>·</span> <span>—</span>',
      '      {label}',
      '      <input placeholder={label} type="text" aria-hidden="true" />',
      '      <img alt="" />',
      '    </section>',
      '  )',
      '}',
      "const kind: 'Hola' = 'Hola'",
    ].join('\n')
    expect(findCopyLiterals(source)).toEqual([])
  })

  test('a comparison and a generic are not JSX text', () => {
    const source = 'const a = <T,>(x: T) => x\nexport const ok = 1 < 2 && 3 > 2 ? <i /> : null'
    expect(findCopyLiterals(source)).toEqual([])
  })
})

describe('TEXT_ATTRIBUTES', () => {
  test('names the five attributes a person reads', () => {
    expect([...TEXT_ATTRIBUTES].sort()).toEqual(['alt', 'aria-label', 'aria-valuetext', 'placeholder', 'title'])
  })
})

describe('findCopyImports', () => {
  const imports = (source: string, kind: 'ts' | 'tsx' = 'tsx') => findCopyImports(source, kind)

  test('reads the exported names of a named import, not the local ones', () => {
    expect(imports("import { A, B as C } from '../copy/sales'")).toEqual([{ copyFile: 'sales.ts', names: ['A', 'B'] }])
  })

  test('reads a default import as the name default, with or without the .ts suffix', () => {
    expect(imports("import X from '../copy/sales.ts'")).toEqual([{ copyFile: 'sales.ts', names: ['default'] }])
    expect(imports("import X, { A } from '../copy/sales'")).toEqual([{ copyFile: 'sales.ts', names: ['default', 'A'] }])
  })

  test('reads a namespace import as every name', () => {
    expect(imports("import * as S from '../../copy/sales'")).toEqual([{ copyFile: 'sales.ts', names: '*' }])
  })

  test('reads a re-export: named, and star', () => {
    expect(imports("export { A, B as C } from '../copy/stock'")).toEqual([{ copyFile: 'stock.ts', names: ['A', 'B'] }])
    expect(imports("export * from '../copy/stock'")).toEqual([{ copyFile: 'stock.ts', names: '*' }])
  })

  test('reads a dynamic import with a literal argument as every name', () => {
    expect(imports("const m = import('../copy/sales')\nconst n = await import(`../copy/stock.ts`)")).toEqual([
      { copyFile: 'sales.ts', names: '*' },
      { copyFile: 'stock.ts', names: '*' },
    ])
  })

  test('ignores a dynamic import whose argument is not a literal', () => {
    expect(imports('const m = import(`../copy/${name}`)\nconst n = import(path)')).toEqual([])
  })

  test('ignores type-only imports and re-exports, whole or by specifier', () => {
    expect(imports("import type { A } from '../copy/sales'")).toEqual([])
    expect(imports("import type * as S from '../copy/sales'")).toEqual([])
    expect(imports("export type { A } from '../copy/sales'")).toEqual([])
    expect(imports("import { type A } from '../copy/sales'")).toEqual([])
    expect(imports("import { type A, B } from '../copy/sales'")).toEqual([{ copyFile: 'sales.ts', names: ['B'] }])
  })

  test('ignores a side-effect import, a locale file and a path that only ends alike', () => {
    expect(imports("import '../copy/sales'")).toEqual([])
    expect(imports("import en from '../copy/locales/en/common.json'")).toEqual([])
    expect(imports("import { A } from '../copy/sales.json'")).toEqual([])
    expect(imports("import { A } from '../notcopy/sales'")).toEqual([])
    expect(imports("import { A } from '../copy/sales/extra'")).toEqual([])
  })

  test('reads one entry per import, in reading order, in a .ts source with a type assertion', () => {
    const source = ["import { A } from '../copy/sales'", 'const x = <string>y', "import { B } from '../copy/stock'"].join('\n')
    expect(imports(source, 'ts')).toEqual([
      { copyFile: 'sales.ts', names: ['A'] },
      { copyFile: 'stock.ts', names: ['B'] },
    ])
  })
})

describe('SCANNED', () => {
  test('takes .ts and .tsx under screens, shell and components', () => {
    expect(SCANNED.roots).toEqual(['screens', 'shell', 'components'])
    for (const path of ['/src/screens/Gastos.tsx', '/src/shell/Shell.tsx', '/src/components/a/b.ts']) expect(isScanned(path)).toBe(true)
  })

  test('leaves out tests and fixtures folders by suffix and segment only', () => {
    const left = ['/src/screens/Gastos.test.tsx', '/src/shell/x.test.ts', '/src/components/fixtures/a.tsx', '/src/screens/fixtures/deep/a.ts']
    for (const path of [...left, '/src/copy/sales.ts', '/src/i18n/a.ts', '/src/screens/a.css']) expect(isScanned(path)).toBe(false)
    expect(isScanned('/src/screens/fixturesAndMore.tsx')).toBe(true)
    expect(isScanned('/src/screens/a.testing.tsx')).toBe(true)
  })
})

describe('the real tree', () => {
  test('no screen, shell or component file writes a text of its own', async () => {
    const entries = Object.entries(await scannedSources()).filter(([path]) => path.endsWith('.tsx'))
    expect(entries.some(([path]) => path === '/src/screens/Gastos.tsx')).toBe(true)
    expect(entries.some(([path]) => path === '/src/shell/Shell.tsx')).toBe(true)
    expect(entries.some(([path]) => path === '/src/components/Boton.tsx')).toBe(true)
    const offenders = entries.flatMap(([path, source]) =>
      findCopyLiterals(source).map(({ line, kind, text }) => `${path}:${line}: ${kind} "${text}"`),
    )
    expect(offenders).toEqual([])
  })
})
