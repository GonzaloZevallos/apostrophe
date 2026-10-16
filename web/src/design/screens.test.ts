import { describe, expect, it } from 'vitest'
import { assertScreens } from '../../../scripts/design/screens.mjs'
import screens from '../../../scripts/design/screens.json'

describe('assertScreens', () => {
  it('refuses an entry with color_scheme', () => {
    expect(() => assertScreens([{ screen: 'Inicio', color_scheme: 'dark' }])).toThrow(
      /Inicio: color_scheme is retired, use tema: 'oscuro'/,
    )
  })

  it('refuses an entry with an unknown tema', () => {
    expect(() => assertScreens([{ screen: 'Inicio', tema: 'claro' }])).toThrow(
      /Inicio: unknown tema "claro"/,
    )
  })

  it('refuses color_scheme first when an entry has both', () => {
    expect(() =>
      assertScreens([{ screen: 'Inicio', color_scheme: 'dark', tema: 'claro' }]),
    ).toThrow(/Inicio: color_scheme is retired, use tema: 'oscuro'/)
  })

  it('accepts tema: oscuro and an entry with no tema', () => {
    expect(() =>
      assertScreens([{ screen: 'InicioOscuro', tema: 'oscuro' }, { screen: 'Inicio' }]),
    ).not.toThrow()
  })

  it('refuses a duplicate screen name', () => {
    expect(() => assertScreens([{ screen: 'Entrar' }, { screen: 'Entrar' }])).toThrow(
      /Entrar: screen is not unique/,
    )
  })

  it('refuses a design with no file under pantallas/', () => {
    expect(() => assertScreens([{ screen: 'Reset', design: 'NoExiste' }])).toThrow(
      /Reset: design NoExiste has no pantallas\/NoExiste\.dc\.html/,
    )
  })

  it('refuses a section whose text is not in the design file', () => {
    expect(() =>
      assertScreens([{ screen: 'EstadosX', design: 'Estados', section: 'Texto que no está' }]),
    ).toThrow(/EstadosX: section "Texto que no está" is not in Estados\.dc\.html/)
  })

  it('refuses a design or a section that is not a string', () => {
    expect(() => assertScreens([{ screen: 'Reset', design: 7 }])).toThrow(
      /Reset: design must be a string/,
    )
    expect(() => assertScreens([{ screen: 'Estados', section: 7 }])).toThrow(
      /Estados: section must be a string/,
    )
  })

  it('refuses a section with no design file to look in', () => {
    expect(() => assertScreens([{ screen: 'NoExiste', section: 'Sin conexión' }])).toThrow(
      /NoExiste: design NoExiste has no pantallas\/NoExiste\.dc\.html/,
    )
  })

  it('accepts a design, a section and an offline step', () => {
    expect(() =>
      assertScreens([
        {
          screen: 'EstadosSinConexion',
          design: 'Estados',
          section: 'Sin conexión',
          steps: [{ offline: true }, { wait: 'Sin conexión: revisá tu internet y probá de nuevo.' }],
        },
      ]),
    ).not.toThrow()
  })

  it('accepts the real screens.json, imported, never copied', () => {
    expect(() => assertScreens(screens.screens)).not.toThrow()
  })
})
