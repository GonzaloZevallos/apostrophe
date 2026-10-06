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

  it('refuses a built screen whose route is not its path', () => {
    expect(() =>
      assertScreens([{ screen: 'Ventas', route: '/ventas', path: '/sales' }]),
    ).toThrow(/Ventas: route "\/ventas" is not its path "\/sales"/)
  })

  it('accepts route = path, a screen not built yet, and a sheet over another route', () => {
    expect(() =>
      assertScreens([
        { screen: 'Ventas', route: '/sales', path: '/sales' },
        { screen: 'VariedadNueva', route: null, path: '/varieties/new' },
        { screen: 'Estados', route: null, path: null },
        { screen: 'Cobro', route: '/customers/{debtor}', path: '/customers/{debtor}/payment', sheet: true },
      ]),
    ).not.toThrow()
  })

  it('accepts the real screens.json, imported, never copied', () => {
    expect(() => assertScreens(screens.screens)).not.toThrow()
  })
})
