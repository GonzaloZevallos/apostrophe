import { describe, expect, it } from 'vitest'
import { assertScreens, assertSelectedAccounts } from '../../../scripts/design/screens.mjs'
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

  it('refuses an account that is not a non-empty string', () => {
    expect(() => assertScreens([{ screen: 'Listo', route: 'ruta', account: 7 }])).toThrow(
      /Listo: account must be a non-empty string/,
    )
    expect(() => assertScreens([{ screen: 'Listo', route: 'ruta', account: '' }])).toThrow(
      /Listo: account must be a non-empty string/,
    )
  })

  it('refuses an account on a signed-out entry', () => {
    expect(() =>
      assertScreens([{ screen: 'Entrar', route: 'ruta', account: 'a_b', signed_out: true }]),
    ).toThrow(/Entrar: account cannot be used with signed_out/)
  })

  it('refuses an account entry that uses a placeholder other than {email}', () => {
    expect(() =>
      assertScreens([{ screen: 'Ficha', route: 'ruta/{customer_id}', account: 'a_b' }]),
    ).toThrow(/Ficha: an account entry can only use \{email\}, not \{customer_id\}/)
    expect(() =>
      assertScreens([
        { screen: 'Paso', route: 'ruta', account: 'a_b', steps: [{ fill: { label: 'Cliente', value: '{customer_id}' } }] },
      ]),
    ).toThrow(/Paso: an account entry can only use \{email\}, not \{customer_id\}/)
    expect(() =>
      assertScreens([{ screen: 'Click', route: 'ruta', account: 'a_b', steps: [{ click: '{sale_id}' }] }]),
    ).toThrow(/Click: an account entry can only use/)
    expect(() =>
      assertScreens([{ screen: 'Wait', route: 'ruta', account: 'a_b', steps: [{ wait: '{sale_id}' }] }]),
    ).toThrow(/Wait: an account entry can only use/)
  })

  it('accepts an account entry that uses {email} only, and a default entry that uses ids', () => {
    expect(() =>
      assertScreens([
        {
          screen: 'ListoCompu',
          route: 'ruta',
          account: 'listo_compu',
          steps: [{ fill: { label: 'Email', value: '{email}' } }, { click: 'Listo' }, { wait: 'Listo' }],
        },
        { screen: 'Ficha', route: 'ruta/{customer_id}' },
      ]),
    ).not.toThrow()
  })

  it('accepts the real screens.json, imported, never copied', () => {
    expect(() => assertScreens(screens.screens)).not.toThrow()
  })
})

describe('assertSelectedAccounts', () => {
  const accounts = ['listo_compu', 'listo_oscuro']

  it('refuses an account the sample did not write, without naming a credential', () => {
    expect(() =>
      assertSelectedAccounts([{ screen: 'ListoX', account: 'listo_otro' }], accounts),
    ).toThrow(/^ListoX: account is not one of the sample's accounts$/)
    expect(() => assertSelectedAccounts([{ screen: 'ListoX', account: 'listo_compu' }], [])).toThrow(
      /ListoX: account is not one of/,
    )
  })

  it('refuses two Listo entries on the same account, the default one included', () => {
    expect(() =>
      assertSelectedAccounts(
        [
          { screen: 'OnboardingListo' },
          { screen: 'ListoOscuro', design: 'OnboardingListo', tema: 'oscuro' },
        ],
        accounts,
      ),
    ).toThrow(/ListoOscuro: reaches OnboardingListo with the same account as OnboardingListo/)
    expect(() =>
      assertSelectedAccounts(
        [
          { screen: 'A', design: 'OnboardingListo', account: 'listo_compu' },
          { screen: 'B', design: 'OnboardingListo', account: 'listo_compu' },
        ],
        accounts,
      ),
    ).toThrow(/B: reaches OnboardingListo with the same account as A/)
  })

  it('accepts one Listo per business, and other entries sharing an account', () => {
    expect(() =>
      assertSelectedAccounts(
        [
          { screen: 'OnboardingListo' },
          { screen: 'ListoCompu', design: 'OnboardingListo', account: 'listo_compu' },
          { screen: 'ListoOscuro', design: 'OnboardingListo', account: 'listo_oscuro', tema: 'oscuro' },
          { screen: 'Inicio', account: 'listo_compu' },
          { screen: 'Ventas', account: 'listo_compu' },
        ],
        accounts,
      ),
    ).not.toThrow()
  })

  it('accepts the real screens.json with no accounts', () => {
    expect(() => assertSelectedAccounts(screens.screens, [])).not.toThrow()
  })
})
