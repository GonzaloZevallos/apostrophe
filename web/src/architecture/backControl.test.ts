import { describe, expect, test } from 'vitest'
import { checkBackControl } from './backControl'

const SCREEN = 'src/screens/Example.tsx'

describe('checkBackControl: what it rejects', () => {
  test('a "‹" glued to a name with a plus', () => {
    const source = "export const label = (name: string) => '‹ ' + name"
    expect(checkBackControl(SCREEN, source)).toHaveLength(1)
  })

  test('a "‹" in a template literal', () => {
    const source = 'export const label = (name: string) => `‹ ${name}`'
    expect(checkBackControl(SCREEN, source)).toHaveLength(1)
  })

  test('a "‹" in a template span after a substitution', () => {
    const source = 'export const label = (name: string) => `${name} ‹ ${name} ›`'
    expect(checkBackControl(SCREEN, source)).toHaveLength(1)
  })

  test('a "‹" in an ariaLabel', () => {
    const source = 'export const A = () => <button ariaLabel="‹ Atrás" />'
    expect(checkBackControl(SCREEN, source)).toHaveLength(1)
  })

  test('a "‹" passed through the label prop of a helper', () => {
    const source = 'export const A = () => <Pill label="‹ Variedades" />'
    expect(checkBackControl(SCREEN, source)).toHaveLength(1)
  })

  test('a "‹" as JSX text with a word after it', () => {
    const source = 'export const A = () => <span>‹ Variedades</span>'
    expect(checkBackControl(SCREEN, source)).toHaveLength(1)
  })

  test('a bare "‹" button named "Volver", which is a back control, not a month arrow', () => {
    const source = 'export const A = () => <button aria-label="Volver">‹</button>'
    expect(checkBackControl(SCREEN, source)).toHaveLength(1)
  })

  test('a bare "‹" button with no aria-label at all', () => {
    const source = 'export const A = () => <button>‹</button>'
    expect(checkBackControl(SCREEN, source)).toHaveLength(1)
  })

  test('an import of BackButton from a screen outside the closed set', () => {
    const source = "import BackButton from '../components/BackButton'"
    expect(checkBackControl('src/screens/Catalogo.tsx', source)).toHaveLength(1)
  })

  test('an import of BackButton written with its extension or its glyph name', () => {
    const source = "import { BACK_GLYPH } from '../components/BackButton.tsx'"
    expect(checkBackControl(SCREEN, source)).toHaveLength(1)
  })

  test('a re-export of BackButton', () => {
    const source = "export { default as BackButton } from '../components/BackButton'"
    expect(checkBackControl('src/components/index.ts', source)).toHaveLength(1)
  })

  test('a dynamic import of BackButton from a screen outside the closed set', () => {
    const source = "export const load = () => import('../components/BackButton')"
    expect(checkBackControl('src/screens/Catalogo.tsx', source)).toHaveLength(1)
  })

  test('a star re-export of BackButton', () => {
    const source = "export * from './BackButton'"
    expect(checkBackControl('src/components/index.ts', source)).toHaveLength(1)
  })

  test('says which file and where', () => {
    const [finding] = checkBackControl(SCREEN, "const a = 1\nconst b = '‹ x'")
    expect(finding).toContain('src/screens/Example.tsx')
    expect(finding).toContain('2')
  })
})

describe('checkBackControl: what it accepts', () => {
  test('a month arrow: exactly "‹" in a button with its own aria-label', () => {
    const source = 'export const A = () => <button aria-label="Mes anterior">‹</button>'
    expect(checkBackControl('src/screens/Gastos.tsx', source)).toEqual([])
  })

  test('a month arrow written across lines, as Análisis writes it', () => {
    const source = `export const A = () => (
  <button type="button" aria-label="Mes anterior">
    ‹
  </button>
)`
    expect(checkBackControl('src/screens/Analisis.tsx', source)).toEqual([])
  })

  test('a comment that holds a "‹"', () => {
    const source = '// the "‹ Variedades" arrow\n/* ‹ */\nexport const a = 1'
    expect(checkBackControl(SCREEN, source)).toEqual([])
  })

  test('any module under shell/, which owns the chrome', () => {
    const source = "import BackButton from '../components/BackButton'\nexport const x = '‹'"
    expect(checkBackControl('src/shell/BackArrow.tsx', source)).toEqual([])
  })

  test('screens/Analisis.tsx importing BackButton', () => {
    const source = "import BackButton from '../components/BackButton'"
    expect(checkBackControl('src/screens/Analisis.tsx', source)).toEqual([])
  })

  test('the BackButton module itself, which defines the glyph', () => {
    const source = "export const BACK_GLYPH = '‹'"
    expect(checkBackControl('src/components/BackButton.tsx', source)).toEqual([])
  })

  test('a test file, which asserts on the glyph', () => {
    const source = "expect(screen.getByText('‹ Variedades')).toBeInTheDocument()"
    expect(checkBackControl('src/screens/Example.test.tsx', source)).toEqual([])
  })

  test('a source with no glyph and no BackButton', () => {
    expect(checkBackControl(SCREEN, "export const a = 'Variedades'")).toEqual([])
  })
})
