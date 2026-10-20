/**
 * `findCopyLiterals` is fed sources it must flag and sources it must pass, with exact counts;
 * then the real `screens/`, `shell/` and `components/` are scanned (ADR-0049, GH-53).
 */

import { describe, expect, test } from 'vitest'
import { findCopyLiterals } from './copyOnly'

describe('findCopyLiterals', () => {
  test('flags JSX text, a string child and the three text attributes: exactly six', () => {
    const source = [
      'export function A({ name }: { name: string }) {',
      '  return (',
      '    <section aria-label="Resumen" title={"Detalle"}>',
      '      <p>Hola {name}</p>',
      '      <p>{\'Chau\'}</p>',
      '      <input placeholder={`Buscar`} />',
      '      <b>3 ventas</b>',
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
      '      <a href="/ventas">{SALES_TEXT.hoy}</a>',
      '      <span>·</span> <span>—</span>',
      '      {label}',
      '      <input placeholder={label} type="text" aria-hidden="true" />',
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

const modules = import.meta.glob(['/src/{screens,shell,components}/**/*.tsx', '!/src/**/*.test.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

describe('the real tree', () => {
  test('no screen, shell or component file writes a text of its own', () => {
    const entries = Object.entries(modules)
    expect(entries.some(([path]) => path === '/src/screens/Gastos.tsx')).toBe(true)
    expect(entries.some(([path]) => path === '/src/shell/Shell.tsx')).toBe(true)
    expect(entries.some(([path]) => path === '/src/components/Boton.tsx')).toBe(true)
    const offenders = entries.flatMap(([path, source]) =>
      findCopyLiterals(source).map(({ line, kind, text }) => `${path}:${line}: ${kind} "${text}"`),
    )
    expect(offenders).toEqual([])
  })
})
