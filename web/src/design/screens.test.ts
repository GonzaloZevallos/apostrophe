import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assertScreens, assertSelectedAccounts, sectionOccurrences } from '../../../scripts/design/screens.mjs'
import screens from '../../../scripts/design/screens.json'
import { TEXT_SCALE } from '../../../scripts/design/textScale.mjs'

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
    expect(() => assertScreens([{ screen: 'Listo', design: 'OnboardingListo', route: 'ruta', account: 7 }])).toThrow(
      /Listo: account must be a non-empty string/,
    )
    expect(() => assertScreens([{ screen: 'Listo', design: 'OnboardingListo', route: 'ruta', account: '' }])).toThrow(
      /Listo: account must be a non-empty string/,
    )
  })

  it('refuses an account on a signed-out entry', () => {
    expect(() =>
      assertScreens([{ screen: 'Entrar', design: 'OnboardingListo', route: 'ruta', account: 'a_b', signed_out: true }]),
    ).toThrow(/Entrar: account cannot be used with signed_out/)
  })

  it('refuses an account entry that uses a placeholder other than {email}', () => {
    expect(() =>
      assertScreens([{ screen: 'Ficha', design: 'OnboardingListo', route: 'ruta/{customer_id}', account: 'a_b' }]),
    ).toThrow(/Ficha: an account entry can only use \{email\}, not \{customer_id\}/)
    expect(() =>
      assertScreens([
        { screen: 'Paso', design: 'OnboardingListo', route: 'ruta', account: 'a_b', steps: [{ fill: { label: 'Cliente', value: '{customer_id}' } }] },
      ]),
    ).toThrow(/Paso: an account entry can only use \{email\}, not \{customer_id\}/)
    expect(() =>
      assertScreens([{ screen: 'Click', design: 'OnboardingListo', route: 'ruta', account: 'a_b', steps: [{ click: '{sale_id}' }] }]),
    ).toThrow(/Click: an account entry can only use/)
    expect(() =>
      assertScreens([{ screen: 'Wait', design: 'OnboardingListo', route: 'ruta', account: 'a_b', steps: [{ wait: '{sale_id}' }] }]),
    ).toThrow(/Wait: an account entry can only use/)
  })

  it('accepts an account entry that uses {email} only, and a default entry that uses ids', () => {
    expect(() =>
      assertScreens([
        {
          screen: 'ListoCompu',
          design: 'OnboardingListo',
          route: 'ruta',
          account: 'listo_compu',
          steps: [{ fill: { label: 'Email', value: '{email}' } }, { click: 'Listo' }, { wait: 'Listo' }],
        },
        { screen: 'Ficha', route: 'ruta/{customer_id}' },
      ]),
    ).not.toThrow()
  })

  it('refuses an account on an entry that does not reach Listo, by name and never by credential', () => {
    expect(() => assertScreens([{ screen: 'Inicio', route: 'ruta', account: 'listo_compu' }])).toThrow(
      /^Inicio: only an entry that reaches OnboardingListo can name an account$/,
    )
    expect(() =>
      assertScreens([{ screen: 'Ventas', design: 'Estados', route: 'ruta', account: 'listo' }]),
    ).toThrow(/Ventas: only an entry that reaches OnboardingListo can name an account/)
  })

  it('refuses an entry that reaches Listo with no account', () => {
    expect(() => assertScreens([{ screen: 'OnboardingListo', route: 'ruta' }])).toThrow(
      /^OnboardingListo: an entry that reaches OnboardingListo must name an account of its own$/,
    )
    expect(() =>
      assertScreens([{ screen: 'ListoOscuro', design: 'OnboardingListo', tema: 'oscuro' }]),
    ).toThrow(/ListoOscuro: an entry that reaches OnboardingListo must name an account of its own/)
  })

  it('accepts a Listo entry with its own account, named by design or by screen', () => {
    expect(() =>
      assertScreens([
        { screen: 'OnboardingListo', route: 'ruta', account: 'listo' },
        { screen: 'ListoOscuro', design: 'OnboardingListo', route: 'ruta', account: 'listo_oscuro' },
        { screen: 'Ficha', route: 'ruta/{customer_id}' },
      ]),
    ).not.toThrow()
  })

  it('refuses a text_scale that is not exactly the model\'s, whatever it looks like', () => {
    for (const value of [1, 1.30001, '130%', null]) {
      expect(() => assertScreens([{ screen: 'Inicio', text_scale: value }])).toThrow(
        /^Inicio: text_scale must be exactly 1\.3$/,
      )
    }
  })

  it('refuses a viewport that is not a pair of positive integers', () => {
    for (const value of [[320], [320, 0], [320.5, 844], [320, 844, 1], [-320, 844], '320x844', null]) {
      expect(() => assertScreens([{ screen: 'Inicio', viewport: value }])).toThrow(
        /^Inicio: viewport must be two positive integers, width and height$/,
      )
    }
  })

  it('accepts a 320 px viewport with the text scale', () => {
    expect(() =>
      assertScreens([{ screen: 'InicioTexto130', route: 'ruta', viewport: [320, 844], text_scale: 1.3 }]),
    ).not.toThrow()
  })

  it('refuses a section that occurs more than once in its design file', () => {
    expect(() =>
      assertScreens([{ screen: 'AnalisisX', design: 'Analisis', section: 'Promoción' }]),
    ).toThrow(/^AnalisisX: section "Promoción" occurs \d+ times in Analisis\.dc\.html, expected exactly once$/)
  })

  it('accepts the real screens.json, imported, never copied', () => {
    expect(() => assertScreens(screens.screens)).not.toThrow()
  })
})

describe('the Onboarding rows of the real screens.json', () => {
  type Row = {
    screen: string
    design?: string
    account?: string
    path?: string
    tema?: string
    viewport?: number[]
    text_scale?: number
  }
  const rows = screens.screens as Row[]
  const designOf = (row: Row): string => row.design ?? row.screen
  const SCREENS = [
    'OnboardingVariedad',
    'OnboardingStock',
    'OnboardingMensaje',
    'OnboardingBot',
    'OnboardingSocio',
    'OnboardingCategorias',
    'OnboardingListo',
  ]
  const isComputer = (row: Row): boolean => row.viewport?.[0] === 1280
  const isNarrowScaled = (row: Row): boolean =>
    row.viewport?.[0] === 320 && row.viewport[1] === 844 && row.text_scale === TEXT_SCALE
  const isPlain = (row: Row): boolean => row.viewport === undefined && row.text_scale === undefined

  it.each(SCREENS)('%s is captured on phone and computer, light and dark, and at 320 px with 130 % text', (name) => {
    const own = rows.filter((row) => designOf(row) === name)
    const dark = (row: Row): boolean => row.tema === 'oscuro'
    expect(own.filter((row) => isPlain(row) && !dark(row))).toHaveLength(1)
    expect(own.filter((row) => isPlain(row) && dark(row))).toHaveLength(1)
    expect(own.filter((row) => isComputer(row) && !dark(row))).toHaveLength(1)
    expect(own.filter((row) => isComputer(row) && dark(row))).toHaveLength(1)
    expect(own.filter((row) => isNarrowScaled(row) && !dark(row))).toHaveLength(1)
  })

  // OnboardingVariedad saves the first stock entry on La Huerta, the one default-account
  // row that changes the Onboarding's state; everything else on that account reads the
  // state as it was before, so it has to run first, and its twins after it.
  it('puts every other default-account Onboarding row before OnboardingVariedad, and its twins after', () => {
    const at = rows.findIndex((row) => row.screen === 'OnboardingVariedad')
    expect(at).toBeGreaterThan(-1)
    rows.forEach((row, index) => {
      if (row.account !== undefined || !/^\/onboarding\//.test(row.path ?? '')) return
      if (row.screen === 'OnboardingVariedad') return
      if (designOf(row) === 'OnboardingVariedad') expect(index, row.screen).toBeGreaterThan(at)
      else expect(index, row.screen).toBeLessThan(at)
    })
  })

  it('gives each Listo row an account of its own, and none skips the rest from step 6', () => {
    const listo = rows.filter((row) => designOf(row) === 'OnboardingListo')
    expect(listo).toHaveLength(5)
    const accounts = listo.map((row) => row.account)
    expect(accounts.every((account) => typeof account === 'string')).toBe(true)
    expect(new Set(accounts).size).toBe(listo.length)
    for (const row of listo) {
      const route = (row as Row & { route?: string }).route
      expect(route, row.screen).not.toMatch(/\/categories$/)
    }
  })
})

describe('sectionOccurrences', () => {
  it('counts a label as the text between a tag end and the next tag', () => {
    expect(sectionOccurrences('<b>Otra</b>', 'Listo')).toBe(0)
    expect(sectionOccurrences('<b>Listo</b>', 'Listo')).toBe(1)
    expect(sectionOccurrences('<b>Listo</b><i>Listo</i>', 'Listo')).toBe(2)
    expect(sectionOccurrences('<b>Listo ya</b>', 'Listo')).toBe(0)
  })

  it('counts a label with a literal middle dot, and not the same label written as an entity', () => {
    expect(sectionOccurrences('<b>Listo · oscuro</b>', 'Listo · oscuro')).toBe(1)
    expect(sectionOccurrences('<b>Listo &middot; oscuro</b>', 'Listo · oscuro')).toBe(0)
  })
})

describe('assertSelectedAccounts', () => {
  const accounts = ['listo', 'listo_compu', 'listo_oscuro']

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
          { screen: 'OnboardingListo', account: 'listo' },
          { screen: 'ListoOscuro', design: 'OnboardingListo', account: 'listo', tema: 'oscuro' },
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

  it('refuses two Listo entries whose accounts are both missing, the default owner included', () => {
    expect(() =>
      assertSelectedAccounts(
        [
          { screen: 'OnboardingListo' },
          { screen: 'ListoOscuro', design: 'OnboardingListo', tema: 'oscuro' },
        ],
        accounts,
      ),
    ).toThrow(/ListoOscuro: reaches OnboardingListo with the same account as OnboardingListo/)
  })

  it('accepts one Listo entry per account', () => {
    expect(() =>
      assertSelectedAccounts(
        [
          { screen: 'OnboardingListo', account: 'listo' },
          { screen: 'ListoCompu', design: 'OnboardingListo', account: 'listo_compu' },
          { screen: 'ListoOscuro', design: 'OnboardingListo', account: 'listo_oscuro', tema: 'oscuro' },
          { screen: 'Inicio' },
        ],
        accounts,
      ),
    ).not.toThrow()
  })

  it("accepts the real screens.json with the accounts sample_app.py seeds", () => {
    const source = readFileSync(resolve(process.cwd(), '..', 'scripts/design/sample_app.py'), 'utf-8')
    const declared = /^ONBOARDING_ACCOUNTS = \(([^)]*)\)/m.exec(source)?.[1]
    if (declared === undefined) throw new Error('sample_app.py declares no ONBOARDING_ACCOUNTS')
    const seeded = declared.match(/"[^"]+"/g)?.map((name) => name.slice(1, -1)) ?? []
    expect(seeded.length).toBeGreaterThan(0)
    expect(() => assertSelectedAccounts(screens.screens, seeded)).not.toThrow()
  })
})
