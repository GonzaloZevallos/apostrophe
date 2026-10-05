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

  it('accepts the real screens.json, imported, never copied', () => {
    expect(() => assertScreens(screens.screens)).not.toThrow()
  })
})
