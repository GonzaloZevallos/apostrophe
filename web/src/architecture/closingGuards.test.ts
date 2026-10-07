/** Each closing guard is fed input it must reject, and input it must accept. */

import { describe, expect, test } from 'vitest'
import { findBotonClasses, findRawButtons, findRawSvg, findUnusedIcons, listedIcons } from './closingGuards'

const ICONO = `export const ICON_NAMES = [
  'inicio',
  'tacho',
  'buscar',
  'info',
  'atencion',
] as const`
const VISUAL = `const ACTION_ICON: Record<IconOnlyAction, NombreIcono> = {
  delete: 'tacho',
  search: 'buscar',
}`

describe('findRawSvg', () => {
  test('rejects an <svg> outside Icono and accepts Icono, tests and plain components', () => {
    const files = [
      { path: '/src/screens/Ventas.tsx', content: 'return <svg viewBox="0 0 1 1" />' },
      { path: '/src/components/Icono.tsx', content: 'return <svg viewBox="0 0 22 22" />' },
      { path: '/src/screens/Ventas.test.tsx', content: '<svg>' },
      { path: '/src/screens/Clientes.tsx', content: 'return <Icono nombre="inicio" />' },
    ]
    expect(findRawSvg(files)).toEqual(['/src/screens/Ventas.tsx: draws an <svg> itself, use Icono'])
  })
})

describe('findRawButtons', () => {
  const screen = (content: string) => [{ path: '/src/screens/X.tsx', content }]

  test('rejects a button that looks like an action, with or without a class, in screens and the shell', () => {
    expect(findRawButtons(screen('<button type="button" className="boton" onClick={() => go()}>Ir</button>'))).toHaveLength(1)
    expect(findRawButtons(screen('<button onClick={() => go()}>Ir</button>'))).toHaveLength(1)
    expect(findRawButtons([{ path: '/src/shell/Y.tsx', content: '<button className="x">a</button>' }])).toHaveLength(1)
  })

  test('accepts the closed option and row classes, a switch and a radio, even with a dynamic class', () => {
    const accepted = [
      '<button type="button" className="pildora">a</button>',
      `<button className={on ? 'periodos__boton periodos__boton--activo' : 'periodos__boton'} onClick={() => set(1)}>a</button>`,
      '<button className="fila-gasto">a</button>',
      '<button className="x" role="switch" aria-checked>a</button>',
      '<button role="radio">a</button>',
    ]
    for (const content of accepted) expect(findRawButtons(screen(content))).toEqual([])
  })

  test('reads past an arrow function in an attribute and finds the line', () => {
    const found = findRawButtons(screen('\n\n<button\n  onClick={() => a()}\n  className="boton-enlace"\n>a</button>'))
    expect(found).toEqual(['/src/screens/X.tsx:3: a raw <button> that is not an option or a row, use Boton'])
  })

  test('ignores a button outside screens and shell', () => {
    expect(findRawButtons([{ path: '/src/components/Boton.tsx', content: '<button className="boton">' }])).toEqual([])
  })
})

describe('findBotonClasses', () => {
  test('rejects a boton* class outside Boton and BotonLink, and accepts their authors and look-alikes', () => {
    const files = [
      { path: '/src/screens/A.tsx', content: 'const c = "boton boton--suave"' },
      { path: '/src/shell/B.tsx', content: "className={`boton-nueva-venta`}" },
      { path: '/src/components/Boton.tsx', content: 'const c = "boton"' },
      { path: '/src/components/botonVisual.tsx', content: "const c = 'boton--enlace'" },
      { path: '/src/screens/C.tsx', content: 'const c = "botones-extra"; import Boton from "./Boton"' },
      { path: '/src/screens/A.test.tsx', content: 'const c = "boton"' },
    ]
    expect(findBotonClasses(files).map((line) => line.split(':').slice(0, 2).join(':'))).toEqual([
      '/src/screens/A.tsx:1',
      '/src/screens/A.tsx:1',
      '/src/shell/B.tsx:1',
    ])
  })
})

describe('findUnusedIcons', () => {
  const base = [
    { path: '/src/components/Icono.tsx', content: ICONO },
    { path: '/src/components/botonVisual.tsx', content: VISUAL },
  ]

  test('reads the names Icono lists', () => {
    expect(listedIcons(ICONO)).toEqual(['inicio', 'tacho', 'buscar', 'info', 'atencion'])
  })

  test('rejects every name no screen uses, an action nobody passes, and info and atencion without a caller', () => {
    const files = [...base, { path: '/src/screens/A.tsx', content: '<Icono nombre="inicio" />' }]
    expect(findUnusedIcons(files).map((line) => line.split(':')[0])).toEqual(['tacho', 'buscar', 'info', 'atencion'])
  })

  test('accepts a name written by a screen, an action a screen passes, MasInfo and attention callers', () => {
    const files = [
      ...base,
      { path: '/src/screens/A.tsx', content: '<Icono nombre="inicio" /><Boton variant="icon" action="delete" ariaLabel="Borrar" />' },
      { path: '/src/screens/B.tsx', content: '<Boton variant="icon" action={"search"} /><MasInfo>x</MasInfo>' },
      { path: '/src/shell/C.tsx', content: '<Notice attention>x</Notice>' },
    ]
    expect(findUnusedIcons(files)).toEqual([])
  })

  test('does not count a name only Icono or Boton write', () => {
    const files = [
      ...base,
      { path: '/src/components/Boton.tsx', content: "'inicio' 'tacho' 'buscar' 'info' 'atencion'" },
    ]
    expect(findUnusedIcons(files)).toHaveLength(5)
  })
})
