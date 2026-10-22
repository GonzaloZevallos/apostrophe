/** `findOwnBacks` is fed input it must reject, and input it must accept. */

import { describe, expect, test } from 'vitest'
import { findOwnBacks, withoutComments } from './backGuards'

const file = (content: string, path = '/src/screens/X.tsx') => [{ path, content }]

describe('findOwnBacks', () => {
  test("rejects a screen's own back, as a variant, as JSX text, as a string, as an escape", () => {
    expect(findOwnBacks(file('<Boton variant="back" onClick={go}>x</Boton>'))).toHaveLength(1)
    expect(findOwnBacks(file("<BotonLink to={P} variant='back'>x</BotonLink>"))).toHaveLength(1)
    expect(findOwnBacks(file('<p>\n  ‹ Varieties\n</p>'))).toEqual([
      "/src/screens/X.tsx:2: writes a '‹' itself; only the shell's BackArrow does",
    ])
    expect(findOwnBacks(file("const label = '‹ Varieties'"))).toHaveLength(1)
    expect(findOwnBacks(file('const label = `‹ ${name}`'))).toHaveLength(1)
    expect(findOwnBacks(file("const label = '\\u2039 Variedades'"))).toHaveLength(1)
    expect(findOwnBacks(file('<p>&lsaquo; Variedades</p>'))).toHaveLength(1)
  })

  test('a chevron after a string that holds // is still found; a quote in JSX text does not hide the next line', () => {
    expect(findOwnBacks(file("const url = 'http://x'; const back = '‹ Atrás'"))).toHaveLength(1)
    expect(findOwnBacks(file("<p>L'ultima</p>\n<p>‹ Volver</p>"))).toHaveLength(1)
  })

  test('accepts the shell author, comments, tests, the back union and plain screens', () => {
    expect(findOwnBacks(file('<Boton variant="back">{`‹ ${t}`}</Boton>', '/src/shell/BackArrow.tsx'))).toEqual([])
    expect(findOwnBacks(file('// the "‹ parent" arrow\n/** ‹ title */\nconst a = 1'))).toEqual([])
    expect(findOwnBacks(file('<p>‹</p>', '/src/screens/X.test.tsx'))).toEqual([])
    expect(findOwnBacks(file("variant: 'link' | 'undo' | 'back'", '/src/components/Boton.tsx'))).toEqual([])
    expect(findOwnBacks(file('<Boton variant="secondary" icon="agregar">Cargar</Boton>'))).toEqual([])
  })

  test('a named exemption lets its file through, and only its file', () => {
    const exempt = [{ path: '/src/screens/X.tsx', reason: 'a stepper' }]
    expect(findOwnBacks(file('<p>‹</p>'), exempt)).toEqual([])
    expect(findOwnBacks(file('<p>‹</p>', '/src/screens/Y.tsx'), exempt)).toHaveLength(1)
    expect(findOwnBacks(file('<Boton variant="back">x</Boton>'), exempt)).toHaveLength(1)
    expect(findOwnBacks(file('<Boton variant="back">x</Boton>'), [], exempt)).toEqual([])
  })
})

test('withoutComments keeps line numbers', () => {
  expect(withoutComments('a\n/* x\ny */\nb // c').split('\n')).toHaveLength(4)
})
