import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assertScreens, assertSelectedAccounts, assertSelectedNeeds } from '../../../scripts/design/screens.mjs'
import { COMPUTER_MIN_WIDTH } from '../shell/useViewport'
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

  it('refuses a needs that is not a non-empty string', () => {
    expect(() => assertScreens([{ screen: 'A' }, { screen: 'B', needs: 7 }])).toThrow(
      /^B: needs must be a non-empty string$/,
    )
    expect(() => assertScreens([{ screen: 'A' }, { screen: 'B', needs: '' }])).toThrow(
      /B: needs must be a non-empty string/,
    )
  })

  it('refuses a needs that names no screen, and one that is not earlier in the file', () => {
    expect(() => assertScreens([{ screen: 'A' }, { screen: 'B', needs: 'Z' }])).toThrow(
      /^B: needs names Z, which is not a screen of the file$/,
    )
    expect(() => assertScreens([{ screen: 'A', needs: 'B' }, { screen: 'B' }])).toThrow(
      /^A: needs names B, which is not earlier in the file$/,
    )
    expect(() => assertScreens([{ screen: 'A', needs: 'A' }])).toThrow(
      /A: needs names A, which is not earlier in the file/,
    )
  })

  it('accepts a needs that names an earlier screen', () => {
    expect(() => assertScreens([{ screen: 'A' }, { screen: 'B', needs: 'A' }])).not.toThrow()
  })

  it('accepts the real screens.json, imported, never copied', () => {
    expect(() => assertScreens(screens.screens)).not.toThrow()
  })
})

describe('assertScreens checks every step against one closed list of shapes', () => {
  const withSteps = (steps: unknown) => [{ screen: 'Paso', steps }] as const

  it('accepts each shape: click, press, wait, fill, select and offline', () => {
    expect(() =>
      assertScreens(
        withSteps([
          { click: 'Semana' },
          { press: 'Borrar venta' },
          { wait: 'Stock y entradas' },
          { fill: { label: 'Gramos', value: '{email}' } },
          { select: { label: 'Variedad línea 1', index: 0 } },
          { offline: true },
        ]),
      ),
    ).not.toThrow()
  })

  it('refuses a step with an unknown key, naming the entry and the step index', () => {
    expect(() => assertScreens(withSteps([{ click: 'A' }, { hover: 'B' }]))).toThrow(
      /^Paso: step 1 is not one of click, press, wait, fill, select, offline$/,
    )
  })

  it('refuses a step with no key or with two keys', () => {
    expect(() => assertScreens(withSteps([{}]))).toThrow(/^Paso: step 0 must have exactly one key$/)
    expect(() => assertScreens(withSteps([{ click: 'A', wait: 'B' }]))).toThrow(
      /^Paso: step 0 must have exactly one key$/,
    )
  })

  it('refuses a step that is not an object, and steps that are not a list', () => {
    expect(() => assertScreens(withSteps(['click']))).toThrow(/^Paso: step 0 must be an object$/)
    expect(() => assertScreens(withSteps([null]))).toThrow(/^Paso: step 0 must be an object$/)
    expect(() => assertScreens(withSteps({ click: 'A' }))).toThrow(/^Paso: steps must be a list$/)
  })

  it.each(['click', 'press', 'wait'])('refuses %s with anything but a non-empty string', (key) => {
    for (const value of ['', 7, true, null, { label: 'A' }]) {
      expect(() => assertScreens(withSteps([{ [key]: value }]))).toThrow(
        new RegExp(`^Paso: step 0 ${key} must be a non-empty string$`),
      )
    }
  })

  it('refuses fill without exactly a string label and a string value', () => {
    const message = /^Paso: step 0 fill must be exactly \{label, value\}, both strings$/
    for (const fill of ['x', null, {}, { label: 'A' }, { label: 'A', value: 1 }, { label: 7, value: 'a' }]) {
      expect(() => assertScreens(withSteps([{ fill }]))).toThrow(message)
    }
    expect(() => assertScreens(withSteps([{ fill: { label: 'A', value: 'a', extra: 'b' } }]))).toThrow(message)
  })

  it('refuses select without exactly a string label and a non-negative integer index', () => {
    const message = /^Paso: step 0 select must be exactly \{label, index\}, a string and a non-negative integer$/
    for (const select of [
      'x',
      null,
      {},
      { label: 'A' },
      { label: 'A', index: '1' },
      { label: 'A', index: -1 },
      { label: 'A', index: 1.5 },
      { label: 7, index: 1 },
    ]) {
      expect(() => assertScreens(withSteps([{ select }]))).toThrow(message)
    }
    expect(() => assertScreens(withSteps([{ select: { label: 'A', index: 1, extra: 'b' } }]))).toThrow(message)
  })

  it('refuses offline with anything but true', () => {
    for (const offline of [false, 1, 'true', null, {}]) {
      expect(() => assertScreens(withSteps([{ offline }]))).toThrow(/^Paso: step 0 offline must be true$/)
    }
  })

  it('does not put the step data in a refusal', () => {
    expect(() => assertScreens(withSteps([{ fill: { label: 'Secreto', value: 'clave-1234', extra: 1 } }]))).toThrow(
      /^(?!.*(Secreto|clave-1234))/,
    )
  })

  it('scans a press step for placeholders in an account entry', () => {
    expect(() =>
      assertScreens([
        { screen: 'Paso', design: 'OnboardingListo', route: 'ruta', account: 'a_b', steps: [{ press: '{sale_id}' }] },
      ]),
    ).toThrow(/Paso: an account entry can only use/)
  })
})

describe('assertSelectedNeeds', () => {
  const all = [{ screen: 'A' }, { screen: 'B', needs: 'A' }, { screen: 'C' }]

  it('refuses a selection that drops the row a selected one needs, naming both', () => {
    expect(() => assertSelectedNeeds([all[1]!, all[2]!], all)).toThrow(
      /^B: needs A, which is not in the selection$/,
    )
  })

  it('accepts a selection with the needed row, and one with no row that needs another', () => {
    expect(() => assertSelectedNeeds([all[0]!, all[1]!], all)).not.toThrow()
    expect(() => assertSelectedNeeds([all[2]!], all)).not.toThrow()
    expect(() => assertSelectedNeeds(all, all)).not.toThrow()
  })

  it('accepts the real screens.json whole, and refuses it without OnboardingVariedad', () => {
    expect(() => assertSelectedNeeds(screens.screens, screens.screens)).not.toThrow()
    const without = screens.screens.filter((s) => s.screen !== 'OnboardingVariedad')
    expect(() => assertSelectedNeeds(without, screens.screens)).toThrow(
      /OnboardingVariedadOscuro: needs OnboardingVariedad, which is not in the selection/,
    )
  })
})

describe('the real registry covers its evidence', () => {
  const names = screens.screens.map((s) => s.screen)

  it('puts every {no_entries} row before OnboardingVariedad, which gives Mango an entry', () => {
    const variedad = names.indexOf('OnboardingVariedad')
    expect(variedad).toBeGreaterThan(-1)
    const rows = screens.screens.filter((s) => s.route?.includes('{no_entries}'))
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) expect(names.indexOf(row.screen)).toBeLessThan(variedad)
  })

  it('has a row for every Onboarding design, phone and computer, light and dark', () => {
    const pantallas = resolve(process.cwd(), '..', 'docs/product/design-system/pantallas')
    const designs = readdirSync(pantallas)
      .filter((file) => /^Onboarding.*\.dc\.html$/.test(file))
      .map((file) => file.replace('.dc.html', ''))
    expect(designs.length).toBeGreaterThan(0)
    const has = (design: string, computer: boolean, dark: boolean) =>
      screens.screens.some((s) => {
        const isComputer = s.viewport !== undefined && s.viewport[0]! >= COMPUTER_MIN_WIDTH
        const isPhone = s.viewport === undefined
        return (s.design ?? s.screen) === design && (computer ? isComputer : isPhone) && (s.tema === 'oscuro') === dark
      })
    for (const design of designs) {
      expect(has(design, false, false), `${design}: phone light`).toBe(true)
      expect(has(design, false, true), `${design}: phone dark`).toBe(true)
      expect(has(design, true, false), `${design}: computer light`).toBe(true)
      expect(has(design, true, true), `${design}: computer dark`).toBe(true)
    }
  })

  it('has the stock entry form from a variety with no entries, in the four combinations', () => {
    const rows = screens.screens.filter((s) => s.route?.includes('{no_entries}'))
    expect(rows.map((s) => s.screen)).toEqual([
      'EntradaStockSinEntradas',
      'EntradaStockSinEntradasOscuro',
      'EntradaStockSinEntradasCompu',
      'EntradaStockSinEntradasCompuOscuro',
    ])
  })
})

describe('an entry whose path names a record names the same placeholders in its route, as written (a path with no placeholder makes no claim, so a route that names a record through it is not checked)', () => {
  interface Declared {
    screen: string
    path?: string | null
    route?: string | null
  }
  interface Mismatch {
    screen: string
    path: string[]
    route: string[]
  }

  const placeholders = (text: string | null | undefined): string[] =>
    Array.from((text ?? '').matchAll(/\{([^{}]+)\}/g), (match) => match[1]!)

  const pathRecordMismatches = (entries: readonly Declared[]): Mismatch[] =>
    entries.flatMap((entry) => {
      const path = placeholders(entry.path)
      const route = placeholders(entry.route)
      if (path.length === 0) return []
      const same = path.length === route.length && path.every((name, index) => name === route[index])
      return same ? [] : [{ screen: entry.screen, path, route }]
    })

  const real = (screen: string): Declared => {
    const entry = screens.screens.find((s) => s.screen === screen)
    if (entry === undefined) throw new Error(`screens.json has no ${screen} entry`)
    return entry
  }

  it('refuses an entry whose path names a record its route does not, naming the screen and the two lists', () => {
    // The dark twin's path names {low}, the record the light row's did before it was corrected.
    const uncorrected = { ...real('VariedadArchivada'), path: real('VariedadArchivadaOscuro').path }
    expect(pathRecordMismatches([uncorrected])).toEqual([
      { screen: 'VariedadArchivada', path: ['low'], route: ['sold_out'] },
    ])
  })

  it('accepts an entry whose path names no record, though its route does', () => {
    const entry = real('EntradaStockSinEntradas')
    expect(placeholders(entry.route)).toEqual(['no_entries'])
    expect(placeholders(entry.path)).toEqual([])
    expect(pathRecordMismatches([entry])).toEqual([])
  })

  it('accepts the real screens.json, imported, never copied', () => {
    expect(pathRecordMismatches(screens.screens)).toEqual([])
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
