import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  assertAccountKinds,
  assertScreens,
  assertSelectedAccounts,
  assertSelectedNeeds,
  sectionOccurrences,
} from '../../../scripts/design/screens.mjs'
import { ROUTE_REGISTRY } from '../mobile-standard/registry'
import { COMPUTER_MIN_WIDTH } from '../shell/useViewport'
import screens from '../../../scripts/design/screens.json'
import { TEXT_SCALE } from '../../../scripts/design/textScale.mjs'
import { textsOf } from './copyTexts'

type CopyFile = Record<string, unknown>

const copyFiles = import.meta.glob<CopyFile>(['/src/copy/*.ts', '!/src/copy/limits.ts', '!/src/copy/baselineArgs.ts', '!/src/copy/*.test.ts'], {
  eager: true,
})

// The sample's own names (scripts/design/sample_app.py), seller data a step may name.
const SAMPLE_NAMES = ['Blue Dream', 'Gelato']
const HOLE = '\u0001'

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The texts of the copy a step may name: each value as a pattern, a hole being any text. */
function copyPatterns(modules: Record<string, CopyFile>): RegExp[] {
  const patterns: RegExp[] = []
  for (const [path, mod] of Object.entries(modules)) {
    for (const text of textsOf(path, mod, HOLE).values()) {
      patterns.push(new RegExp(`^${text.split(HOLE).map(escapeRegExp).join('.+')}$`))
    }
  }
  return patterns
}

type StepRow = { screen: string; steps?: Record<string, unknown>[] }

/** Invariant 12: the string a click, press, wait or fill.label of a registry row names
 * is a copy value or a sample name. (`section` names a block of the Spanish drawing in
 * pantallas/, which stays as drawn, so it is judged against that file by `assertScreens`.) */
function stepTextProblems(rows: StepRow[], modules: Record<string, CopyFile>): string[] {
  const patterns = copyPatterns(modules)
  const known = (text: string): boolean => SAMPLE_NAMES.includes(text) || patterns.some((p) => p.test(text))
  const problems: string[] = []
  for (const row of rows) {
    for (const step of row.steps ?? []) {
      const named: [string, unknown][] = []
      for (const kind of ['click', 'press', 'wait']) if (kind in step) named.push([kind, step[kind]])
      const fill = step.fill
      if (typeof fill === 'object' && fill !== null && 'label' in fill) named.push(['fill.label', fill.label])
      for (const [kind, text] of named) {
        if (typeof text !== 'string' || !known(text)) problems.push(`${row.screen}: ${kind} "${String(text)}" is no copy value`)
      }
    }
  }
  return problems
}

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

  it('refuses a dark twin with no tema', () => {
    expect(() => assertScreens([{ screen: 'InicioOscuro' }])).toThrow(
      /^InicioOscuro: a dark twin must carry tema: 'oscuro'$/,
    )
  })

  it('refuses an Onboarding computer entry with no design, light or dark', () => {
    const message = /^OnboardingStockCompu(Oscuro)?: an Onboarding computer entry must name the phone design it reuses$/
    expect(() => assertScreens([{ screen: 'OnboardingStockCompu' }])).toThrow(message)
    expect(() => assertScreens([{ screen: 'OnboardingStockCompuOscuro', tema: 'oscuro' }])).toThrow(message)
  })

  it('refuses a dark twin with no tema before an Onboarding computer entry with no design, and an unknown tema before both', () => {
    expect(() => assertScreens([{ screen: 'OnboardingStockCompuOscuro' }])).toThrow(
      /^OnboardingStockCompuOscuro: a dark twin must carry tema: 'oscuro'$/,
    )
    expect(() => assertScreens([{ screen: 'InicioOscuro', tema: 'claro' }])).toThrow(
      /^InicioOscuro: unknown tema "claro"$/,
    )
  })

  it('accepts a dark twin with its tema, and an Onboarding computer entry that names its design', () => {
    expect(() => assertScreens([{ screen: 'InicioOscuro', tema: 'oscuro' }])).not.toThrow()
    expect(() =>
      assertScreens([{ screen: 'OnboardingStockCompuOscuro', design: 'OnboardingStock', tema: 'oscuro' }]),
    ).not.toThrow()
  })

  describe('a dark twin and its drawings', () => {
    const MESSAGE = (screen: string) => `${screen}: a dark twin must compare its own dark drawing`
    const pantallasWith = (...files: string[]): string => {
      const dir = mkdtempSync(join(tmpdir(), 'pantallas-'))
      for (const file of files) writeFileSync(join(dir, `${file}.dc.html`), '')
      return dir
    }

    it('refuses the light file when the twin has a drawing named after its own screen', () => {
      const dir = pantallasWith('Inicio', 'InicioOscuro')
      expect(() => assertScreens([{ screen: 'InicioOscuro', design: 'Inicio', tema: 'oscuro' }], dir)).toThrow(
        new Error(MESSAGE('InicioOscuro')),
      )
      expect(() => assertScreens([{ screen: 'InicioOscuro', tema: 'oscuro' }], dir)).not.toThrow()
    })

    it('accepts the light file when no dark drawing exists', () => {
      const dir = pantallasWith('Inicio')
      expect(() => assertScreens([{ screen: 'InicioOscuro', design: 'Inicio', tema: 'oscuro' }], dir)).not.toThrow()
    })

    it('holds a twin of another design to that design\'s own dark drawing', () => {
      const dir = pantallasWith('OnboardingListo', 'OnboardingListoOscuro')
      const row = { screen: 'ListoOscuro', tema: 'oscuro' }
      expect(() => assertScreens([{ ...row, design: 'OnboardingListo' }], dir)).toThrow(new Error(MESSAGE('ListoOscuro')))
      expect(() => assertScreens([{ ...row, design: 'OnboardingListoOscuro' }], dir)).not.toThrow()
    })

    it('prefers the twin\'s own file over its design\'s dark drawing', () => {
      const dir = pantallasWith('OnboardingListo', 'ListoOscuro', 'OnboardingListoOscuro')
      const row = { screen: 'ListoOscuro', tema: 'oscuro' }
      expect(() => assertScreens([{ ...row, design: 'OnboardingListoOscuro' }], dir)).toThrow(
        new Error(MESSAGE('ListoOscuro')),
      )
      expect(() => assertScreens([{ ...row, design: 'ListoOscuro' }], dir)).not.toThrow()
    })

    it('does not treat a design that is itself a dark drawing as a light one', () => {
      const dir = pantallasWith('OnboardingListoOscuro', 'OnboardingListoOscuroOscuro')
      const row = { screen: 'ListoOscuro', design: 'OnboardingListoOscuro', tema: 'oscuro' }
      expect(() => assertScreens([row], dir)).not.toThrow()
    })
  })

  it('accepts a Compu entry outside the Onboarding, and one with Compu in the middle of its name', () => {
    expect(() => assertScreens([{ screen: 'InicioCompu' }])).not.toThrow()
    expect(() => assertScreens([{ screen: 'OnboardingCompuTexto130' }])).not.toThrow()
  })

  it('names the phone design; its viewport is not checked here', () => {
    expect(() =>
      assertScreens([{ screen: 'OnboardingStockCompu', design: 'OnboardingStock' }]),
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

  it('leaves an account on an entry that does not reach Listo to the sample-time check', () => {
    expect(() =>
      assertScreens([
        { screen: 'Inicio', route: 'ruta', account: 'inicio' },
        { screen: 'Ventas', design: 'Estados', route: 'ruta', account: 'inicio' },
      ]),
    ).not.toThrow()
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
        { screen: 'ListoOscuro', design: 'OnboardingListo', route: 'ruta', account: 'listo_oscuro', tema: 'oscuro' },
        { screen: 'Ficha', route: 'ruta/{customer_id}' },
      ]),
    ).not.toThrow()
  })

  it('still refuses a malformed account on an entry that does not reach Listo', () => {
    expect(() => assertScreens([{ screen: 'Inicio', route: 'ruta', account: 7 }])).toThrow(
      /Inicio: account must be a non-empty string/,
    )
    expect(() => assertScreens([{ screen: 'Inicio', route: 'ruta/{customer_id}', account: 'inicio' }])).toThrow(
      /Inicio: an account entry can only use \{email\}/,
    )
    expect(() => assertScreens([{ screen: 'Inicio', route: 'ruta', account: 'inicio', signed_out: true }])).toThrow(
      /Inicio: account cannot be used with signed_out/,
    )
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
      assertScreens([{ screen: 'AnalisisX', design: 'Analisis', section: 'Hoy' }]),
    ).toThrow(/^AnalisisX: section "Hoy" occurs \d+ times in Analisis\.dc\.html, expected exactly once$/)
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

describe('the registry step rule', () => {
  it('accepts the real screens.json: every step names a copy value or a sample name', () => {
    expect(stepTextProblems(screens.screens as StepRow[], copyFiles)).toEqual([])
  })

  it('refuses a step whose text is in neither the copy nor the sample, each kind of step', () => {
    const rows: StepRow[] = [
      { screen: 'A', steps: [{ click: 'Guardar cambios' }, { press: 'Blue Dream' }, { wait: 'Cerrar el día' }] },
      { screen: 'B', steps: [{ fill: { label: 'Nombre raro', value: 'x' } }, { click: 'Save' }] },
    ]
    expect(stepTextProblems(rows, { '/src/copy/a.ts': { A: { save: 'Save' } } })).toEqual([
      'A: click "Guardar cambios" is no copy value',
      'A: wait "Cerrar el día" is no copy value',
      'B: fill.label "Nombre raro" is no copy value',
    ])
  })

  it('reads a function value as a pattern, so a name in a template is accepted', () => {
    const rows: StepRow[] = [{ screen: 'A', steps: [{ wait: 'Variety: Gelato' }, { wait: 'Variety' }] }]
    expect(stepTextProblems(rows, { '/src/copy/a.ts': { A: { of: (name: string) => `Variety: ${name}` } } })).toEqual([
      'A: wait "Variety" is no copy value',
    ])
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

describe('the 130 % rows of the real screens.json', () => {
  type Row = { screen: string; design?: string; viewport?: number[]; text_scale?: number }
  const rows = screens.screens as Row[]
  // GH-272 follow-up: the only Home rows that carry the text scale, each named with its width
  // (960x920, and 1280x920 once the 960 set at 130 % had shown a break).
  const HOME_WIDTH: Record<string, number> = {
    InicioHoyCompu960Texto130: 960,
    InicioHoyCompuTexto130: 1280,
  }
  const HOME_TEXTO130 = Object.keys(HOME_WIDTH)
  const isOnboardingNarrow = (row: Row): boolean =>
    /^Onboarding/.test(row.design ?? row.screen) && row.viewport?.[0] === 320 && row.viewport[1] === 844
  const isNamedHome = (row: Row): boolean =>
    HOME_TEXTO130.includes(row.screen) && row.viewport?.[0] === HOME_WIDTH[row.screen] && row.viewport?.[1] === 920

  it('accepts a 130 % row only as a 320x844 Onboarding row or one of the two named Home rows at their own width x 920', () => {
    const scaled = rows.filter((row) => row.text_scale !== undefined)
    expect(scaled.length).toBeGreaterThan(HOME_TEXTO130.length)
    for (const row of scaled) {
      expect(row.text_scale, row.screen).toBe(TEXT_SCALE)
      expect(isOnboardingNarrow(row) || isNamedHome(row), row.screen).toBe(true)
    }
    expect(scaled.filter(isNamedHome).map((row) => row.screen)).toEqual(HOME_TEXTO130)
  })

  it('refuses the classifier on a Home row by any other name or width', () => {
    const other: Row[] = [
      { screen: 'InicioHoyCompu960Texto130', viewport: [1280, 920], text_scale: TEXT_SCALE },
      { screen: 'InicioHoyCompuTexto130', viewport: [960, 920], text_scale: TEXT_SCALE },
      { screen: 'InicioHoyCompuTexto130', viewport: [1280, 844], text_scale: TEXT_SCALE },
      { screen: 'InicioTexto130', viewport: [1280, 920], text_scale: TEXT_SCALE },
      { screen: 'InicioHoyCompu960Texto130', viewport: [960, 844], text_scale: TEXT_SCALE },
      { screen: 'InicioTexto130', viewport: [960, 920], text_scale: TEXT_SCALE },
      { screen: 'InicioHoyTexto130', viewport: [320, 844], text_scale: TEXT_SCALE },
    ]
    for (const row of other) expect(isOnboardingNarrow(row) || isNamedHome(row), row.screen).toBe(false)
  })

  it('gives every Home row that carries text_scale a viewport at least 900 px wide', () => {
    const home = rows.filter((row) => /^Inicio/.test(row.design ?? row.screen) && row.text_scale !== undefined)
    expect(home.map((row) => row.screen)).toEqual(HOME_TEXTO130)
    for (const row of home) expect(row.viewport?.[0] ?? 0, row.screen).toBeGreaterThanOrEqual(900)
  })
})

describe('the Inicio rows of the real screens.json', () => {
  type Row = {
    screen: string
    design?: string
    section?: string
    tema?: string
    viewport?: number[]
    steps?: Record<string, unknown>[]
    text_scale?: number
    account?: string
    route?: string
    path?: string
  }
  const rows = screens.screens as Row[]
  const row = (name: string): Row => {
    const found = rows.find((r) => r.screen === name)
    if (found === undefined) throw new Error(`screens.json has no ${name} entry`)
    return found
  }
  const clicks = (r: Row): unknown[] => (r.steps ?? []).flatMap((step) => ('click' in step ? [step.click] : []))
  // GH-526: the 2026-10-29 drawings of Inicio and InicioCompu draw one frame, Hoy, so no Inicio row crops to
  // a section any more: `section` is absent on every row of both drawings.

  it('captures Hoy, the tab Inicio opens on, with no step, on phone and computer', () => {
    expect(clicks(row('InicioHoy'))).toEqual([])
    expect(row('InicioHoy')).toMatchObject({ design: 'Inicio' })
    expect(row('InicioHoy').section).toBeUndefined()
    expect(clicks(row('InicioHoyCompu'))).toEqual([])
    expect(row('InicioHoyCompu')).toMatchObject({
      design: 'InicioCompu',
      viewport: [1280, 920],
    })
    expect(row('InicioHoyCompu').section).toBeUndefined()
  })

  it('captures the dark computer Hoy against its own dark drawing, InicioCompuOscuro', () => {
    expect(clicks(row('InicioHoyCompuOscuro'))).toEqual([])
    expect(row('InicioHoyCompuOscuro')).toMatchObject({
      design: 'InicioCompuOscuro',
      tema: 'oscuro',
      viewport: [1280, 920],
    })
    expect(row('InicioHoyCompuOscuro').section).toBeUndefined()
  })

  it('names no section for the computer Hoy rows, since InicioCompu.dc.html draws one frame', () => {
    const drawing = readFileSync(
      resolve(process.cwd(), '..', 'docs/product/design-system/pantallas/InicioCompu.dc.html'),
      'utf-8',
    )
    // A frame label would occur once; the drawing carries none, so a crop could never find its block.
    expect(sectionOccurrences(drawing, 'Hoy · la pestaña con la que abre el panel')).toBe(0)
    for (const key of ['InicioHoyCompu', 'InicioHoyCompuOscuro']) expect(row(key).section, key).toBeUndefined()
  })

  it('captures the dark Hoy against the dark drawing, which draws Hoy alone', () => {
    expect(clicks(row('InicioOscuro'))).toEqual([])
    expect(row('InicioOscuro').tema).toBe('oscuro')
  })

  // GH-526: the 2026-10-29 Inicio and InicioCompu draw one frame, Hoy: there is no Semana or Mes block, so the
  // rows that clicked Week or Month have no drawing to be compared with and were dropped.
  const DROPPED_SEMANA_MES = [
    'Inicio',
    'InicioCompu',
    'InicioCompuOscuro',
    'InicioMesCompu',
    'InicioCompu960',
    'InicioMesCompu960',
    'InicioCompu960Texto130',
    'InicioMesCompu960Texto130',
    'InicioCompuTexto130',
    'InicioMesCompuTexto130',
  ]

  it('has no row that clicks Week or Month against the Hoy-only Inicio drawings', () => {
    const names = rows.map((r) => r.screen)
    for (const name of DROPPED_SEMANA_MES) expect(names, name).not.toContain(name)
    const inicio = rows.filter((r) => ['Inicio', 'InicioCompu', 'InicioOscuro'].includes(r.design ?? r.screen))
    expect(inicio.length).toBeGreaterThan(0)
    for (const r of inicio) expect(clicks(r), r.screen).toEqual([])
  })

  it('keeps every Inicio row in the Inicio drawings, which assertScreens accepts', () => {
    const inicio = rows.filter((r) => /^Inicio(Hoy|Oscuro|Compu)*$/.test(r.screen))
    expect(inicio.map((r) => r.screen)).toEqual([
      'InicioHoy',
      'InicioOscuro',
      'InicioHoyCompu',
      'InicioHoyCompuOscuro',
    ])
    expect(() => assertScreens(inicio)).not.toThrow()
  })

  // GH-272 follow-up: Home's evidence rows. Screenshots judged by eye, never fed to ae.mjs.
  const HOME_EVIDENCE: [string, undefined, number[], string[], number | undefined][] = [
    ['InicioHoyCompu960', undefined, [960, 920], [], undefined],
    ['InicioHoyCompu960Texto130', undefined, [960, 920], [], TEXT_SCALE],
    ['InicioHoyCompuTexto130', undefined, [1280, 920], [], TEXT_SCALE],
  ]

  it.each(HOME_EVIDENCE)('pins %s: design, section, clicks, viewport and text_scale', (name, section, viewport, taps, scale) => {
    const r = row(name)
    expect(r).toMatchObject({
      account: 'inicio',
      // The same route and path as InicioHoyCompu, which is Inicio's own (routes.ts owns the literal).
      route: row('InicioHoyCompu').route,
      path: row('InicioHoyCompu').path,
      design: 'InicioCompu',
      viewport,
    })
    expect(r.section).toBe(section)
    expect(clicks(r)).toEqual(taps)
    expect(r.text_scale).toBe(scale)
    expect(r.tema).toBeUndefined()
  })

  it('keeps the three evidence rows together, in that order', () => {
    const names = rows.map((r) => r.screen)
    const evidence = HOME_EVIDENCE.map(([name]) => name)
    const at = names.indexOf(evidence.at(0) ?? '')
    expect(at).toBeGreaterThan(-1)
    expect(names.slice(at, at + evidence.length)).toEqual(evidence)
  })

  it('explains in the registry note that the evidence rows are screenshots, never compared by ae.mjs', () => {
    expect(screens._).toMatch(/GH-272 follow-up/)
    expect(screens._).toMatch(/never compared by ae\.mjs/)
  })

  it('refuses a section that Compu draws more than once, the reason InicioHoyCompu has none', () => {
    expect(() =>
      assertScreens([{ screen: 'InicioHoyCompu', design: 'InicioCompu', section: 'Hoy' }]),
    ).toThrow(/^InicioHoyCompu: section "Hoy" occurs \d+ times in InicioCompu\.dc\.html, expected exactly once$/)
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

describe('assertScreens checks every step against one closed list of shapes', () => {
  const withSteps = (steps: unknown) => [{ screen: 'Paso', steps }] as const

  it('accepts each shape: click, press, wait, fill, select and offline', () => {
    expect(() =>
      assertScreens(
        withSteps([
          { click: 'Semana' },
          { press: 'Borrar venta' },
          { wait: 'Stock and entries' },
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
    const designs = [
      ...new Set(
        readdirSync(pantallas)
          .filter((file) => /^Onboarding.*\.dc\.html$/.test(file))
          .map((file) => file.replace('.dc.html', '').replace(/Oscuro$/, '')),
      ),
    ]
    expect(designs.length).toBeGreaterThan(0)
    const has = (design: string, computer: boolean, dark: boolean) =>
      screens.screens.some((s) => {
        const isComputer = s.viewport !== undefined && s.viewport[0]! >= COMPUTER_MIN_WIDTH
        const isPhone = s.viewport === undefined
        const own = s.design ?? s.screen
        const named = own === design || (dark && own === `${design}Oscuro`)
        return named && (computer ? isComputer : isPhone) && (s.tema === 'oscuro') === dark
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

describe('the archived variety rows of the real screens.json', () => {
  const pantallas = resolve(process.cwd(), '..', 'docs/product/design-system/pantallas')
  const keys = [
    'VariedadArchivada',
    'VariedadArchivadaOscuro',
    'VariedadArchivadaCompu',
    'VariedadArchivadaCompuOscuro',
    'Archivadas',
    'ArchivadasOscuro',
    'ArchivadasCompu',
    'ArchivadasCompuOscuro',
  ]

  // The Archivadas list's own path, read from the registry's list row.
  const listPath = ROUTE_REGISTRY.find((r) => r.kind === 'card' && r.path.endsWith('archived'))!.path

  it('has each key exactly once', () => {
    for (const key of keys) {
      expect(screens.screens.filter((s) => s.screen === key).length, key).toBe(1)
    }
  })

  it('names, for each, a design file that exists, the light file for a dark twin that has no dark drawing', () => {
    for (const key of keys) {
      const entry = screens.screens.find((s) => s.screen === key)!
      const design = entry.design ?? key
      expect(design, key).toBe(key.replace('Oscuro', ''))
      expect(readdirSync(pantallas), key).toContain(`${design}.dc.html`)
      // The light file is only right while the twin has no dark drawing of its own (GH-526 invariant 6).
      if (key.endsWith('Oscuro')) expect(readdirSync(pantallas), key).not.toContain(`${key}.dc.html`)
    }
  })

  it('reaches the archived page through the seeded variety, on the phone and on the computer', () => {
    for (const key of keys.filter((k) => k.startsWith('VariedadArchivada'))) {
      const entry = screens.screens.find((s) => s.screen === key)!
      expect(entry.route, key).toBe(listPath)
      expect(entry.path, key).toBe(`${listPath.replace(/archived$/, '')}{archived}`)
      expect(entry.steps, key).toEqual([{ click: 'Blue Dream' }, { wait: 'Stock and entries' }])
      expect(entry.viewport !== undefined, key).toBe(key.includes('Compu'))
      expect(entry.tema === 'oscuro', key).toBe(key.endsWith('Oscuro'))
    }
  })

  it('draws Archivadas at the list, on the phone and on the computer, with no step', () => {
    for (const key of keys.filter((k) => k.startsWith('Archivadas'))) {
      const entry = screens.screens.find((s) => s.screen === key)!
      expect(entry.route, key).toBe(listPath)
      expect(entry.path, key).toBe(listPath)
      expect('steps' in entry, key).toBe(false)
      expect(entry.viewport !== undefined, key).toBe(key.includes('Compu'))
    }
  })

  it('keeps archived_parent as the registry row it was', () => {
    const row = ROUTE_REGISTRY.find((r) => r.path === '/varieties/{id}')
    expect(row?.archivedParent).toBe(listPath)
  })
})

describe('an entry whose path names a record names the same placeholders in its route, as written (a path with no placeholder makes no claim, so a route that names a record through it is not checked; nor is a route with no placeholder with a click step that goes through to the record, the archived page reached from the Archivadas list)', () => {
  interface Declared {
    screen: string
    path?: string | null
    route?: string | null
    steps?: readonly Record<string, unknown>[]
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
      if (route.length === 0 && (entry.steps ?? []).some((step) => 'click' in step)) return []
      const same = path.length === route.length && path.every((name, index) => name === route[index])
      return same ? [] : [{ screen: entry.screen, path, route }]
    })

  const real = (screen: string): Declared => {
    const entry = screens.screens.find((s) => s.screen === screen)
    if (entry === undefined) throw new Error(`screens.json has no ${screen} entry`)
    return entry
  }

  it('refuses an entry whose path names a record its route does not, naming the screen and the two lists', () => {
    const uncorrected = { screen: 'VariedadArchivada', path: 'varieties/{low}', route: 'varieties/{sold_out}' }
    expect(pathRecordMismatches([uncorrected])).toEqual([
      { screen: 'VariedadArchivada', path: ['low'], route: ['sold_out'] },
    ])
  })

  it('refuses a path that names a record when the route names none and no step clicks to it', () => {
    const entry = { screen: 'VariedadArchivada', path: 'varieties/{archived}', route: 'varieties/archived' }
    expect(pathRecordMismatches([entry])).toEqual([{ screen: 'VariedadArchivada', path: ['archived'], route: [] }])
    expect(pathRecordMismatches([{ ...entry, steps: [{ wait: 'Stock and entries' }] }])).toEqual([
      { screen: 'VariedadArchivada', path: ['archived'], route: [] },
    ])
    expect(pathRecordMismatches([{ ...entry, steps: [{ click: 'Blue Dream' }] }])).toEqual([])
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
  const kinds = {
    listo: 'open',
    listo_compu: 'open',
    listo_oscuro: 'open',
    inicio: 'ended',
  } as const

  it('refuses an account the sample did not write, without naming a credential', () => {
    expect(() =>
      assertSelectedAccounts([{ screen: 'ListoX', account: 'listo_otro' }], kinds),
    ).toThrow(/^ListoX: account is not one of the sample's accounts$/)
    expect(() => assertSelectedAccounts([{ screen: 'ListoX', account: 'listo_compu' }], {})).toThrow(
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
        kinds,
      ),
    ).toThrow(/ListoOscuro: reaches OnboardingListo with the same account as OnboardingListo/)
    expect(() =>
      assertSelectedAccounts(
        [
          { screen: 'A', design: 'OnboardingListo', account: 'listo_compu' },
          { screen: 'B', design: 'OnboardingListo', account: 'listo_compu' },
        ],
        kinds,
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
        kinds,
      ),
    ).toThrow(/ListoOscuro: reaches OnboardingListo with the same account as OnboardingListo/)
  })

  it('accepts one Listo entry per open account', () => {
    expect(() =>
      assertSelectedAccounts(
        [
          { screen: 'OnboardingListo', account: 'listo' },
          { screen: 'ListoCompu', design: 'OnboardingListo', account: 'listo_compu' },
          { screen: 'ListoOscuro', design: 'OnboardingListo', account: 'listo_oscuro', tema: 'oscuro' },
          { screen: 'Inicio' },
        ],
        kinds,
      ),
    ).not.toThrow()
  })

  it('accepts entries on an ended account, and lets several of them share it', () => {
    expect(() =>
      assertSelectedAccounts(
        [
          { screen: 'Inicio', account: 'inicio' },
          { screen: 'InicioHoy', design: 'Inicio', account: 'inicio' },
          { screen: 'InicioOscuro', account: 'inicio', tema: 'oscuro' },
        ],
        kinds,
      ),
    ).not.toThrow()
  })

  it('refuses an ended account on an entry that reaches Listo, by name and never by credential', () => {
    expect(() =>
      assertSelectedAccounts([{ screen: 'OnboardingListo', account: 'inicio' }], kinds),
    ).toThrow(/^OnboardingListo: reaches OnboardingListo on an ended account, and a Listo entry needs an open one$/)
    expect(() =>
      assertSelectedAccounts([{ screen: 'ListoX', design: 'OnboardingListo', account: 'inicio' }], kinds),
    ).toThrow(/ListoX: reaches OnboardingListo on an ended account/)
  })

  it('refuses an open account on an entry that does not reach Listo', () => {
    expect(() => assertSelectedAccounts([{ screen: 'Inicio', account: 'listo_compu' }], kinds)).toThrow(
      /^Inicio: names an open account but does not reach OnboardingListo, so only an ended account can serve it$/,
    )
    expect(() =>
      assertSelectedAccounts([{ screen: 'Ventas', design: 'Estados', account: 'listo' }], kinds),
    ).toThrow(/Ventas: names an open account but does not reach OnboardingListo/)
  })

  it('refuses an account that is missing from the kinds, even when the sample wrote it', () => {
    expect(() =>
      assertSelectedAccounts([{ screen: 'Inicio', account: 'inicio' }], { listo: 'open' }),
    ).toThrow(/^Inicio: account is not one of the sample's accounts$/)
  })

  // Both constants must exist in sample_app.py: a rename or a removal fails here, it never goes quiet.
  const source = readFileSync(resolve(process.cwd(), '..', 'scripts/design/sample_app.py'), 'utf-8')
  it("accepts the real screens.json with the kinds sample_app.py seeds", () => {
    const namesOf = (constant: string): string[] => {
      const declared = new RegExp(`^${constant} = \\(([^)]*)\\)`, 'm').exec(source)?.[1]
      if (declared === undefined) throw new Error(`sample_app.py declares no ${constant}`)
      return declared.match(/"[^"]+"/g)?.map((name) => name.slice(1, -1)) ?? []
    }
    const open = namesOf('ONBOARDING_ACCOUNTS')
    const ended = namesOf('ENDED_ONBOARDING_ACCOUNTS')
    expect(open.length).toBeGreaterThan(0)
    expect(ended.length).toBeGreaterThan(0)
    expect(open.filter((name) => ended.includes(name))).toEqual([])
    const real: Record<string, 'open' | 'ended'> = {
      ...Object.fromEntries(open.map((name) => [name, 'open' as const])),
      ...Object.fromEntries(ended.map((name) => [name, 'ended' as const])),
    }
    // GH-274, deliberate: the original two-kind map cannot hold, the registry now names more accounts.
    // `assertSelectedAccounts` throws, and this fails, when a registry row names an account the sample
    // declares under none of the five kinds.
    const all: Record<string, 'open' | 'ended' | 'pre_onboarding' | 'imported' | 'onboarding'> = {
      ...real,
      ...Object.fromEntries(namesOf('PRE_ONBOARDING_ACCOUNTS').map((name) => [name, 'pre_onboarding' as const])),
      ...Object.fromEntries(namesOf('IMPORTED_ACCOUNTS').map((name) => [name, 'imported' as const])),
      ...Object.fromEntries(namesOf('ONBOARDING_FRAME_ACCOUNTS').map((name) => [name, 'onboarding' as const])),
    }
    expect(() => assertSelectedAccounts(screens.screens, all)).not.toThrow()
  })

  it('puts the four Inicio rows on an ended account and each first-run frame on its own account', () => {
    const accountOf = (key: string) => (screens.screens.find((s) => s.screen === key) as { account?: string }).account
    for (const key of ['InicioHoy', 'InicioOscuro', 'InicioHoyCompu', 'InicioHoyCompuOscuro']) {
      expect(accountOf(key), key).toBe('inicio')
    }
    const frames: Record<string, string[]> = {
      primera_vez: ['InicioPrimeraVez', 'InicioPrimeraVezCompu', 'InicioPrimeraVezOscuro'],
      en_curso: ['InicioOnboardingEnCurso', 'InicioOnboardingEnCursoCompu', 'InicioOnboardingEnCursoOscuro'],
      completo: ['InicioOnboardingCompleto', 'InicioOnboardingCompletoCompu', 'InicioOnboardingCompletoOscuro'],
    }
    for (const [account, keys] of Object.entries(frames)) {
      for (const key of keys) expect(accountOf(key), key).toBe(account)
    }
  })

  it('names a section and an account on every row drawn against a first-run file, and refuses one that does not', () => {
    const firstRunRows = (rows: { screen: string; design?: string; section?: string; account?: string }[]) =>
      rows.filter((s) => ['InicioPrimeraVez', 'InicioPrimeraVezCompu'].includes(s.design ?? s.screen))
    const missing = (rows: { screen: string; design?: string; section?: string; account?: string }[]) =>
      firstRunRows(rows)
        .filter((s) => !s.section || !s.account)
        .map((s) => s.screen)
    const rows = screens.screens as { screen: string; design?: string; section?: string; account?: string }[]
    expect(firstRunRows(rows).map((s) => s.screen)).toHaveLength(9)
    expect(missing(rows)).toEqual([])
    // the check itself: a row with no account, or no section, is caught.
    const broken = [
      { screen: 'InicioPrimeraVez', section: 'x' },
      { screen: 'InicioOnboardingEnCurso', design: 'InicioPrimeraVez', account: 'en_curso' },
    ]
    expect(missing(broken)).toEqual(['InicioPrimeraVez', 'InicioOnboardingEnCurso'])
  })

  it('draws each Onboarding frame from its own block: the dark rows from the "· tema oscuro" one, the others not', () => {
    const rows = screens.screens as { screen: string; section?: string; tema?: string }[]
    for (const key of ['InicioOnboardingEnCurso', 'InicioOnboardingCompleto']) {
      for (const suffix of ['', 'Compu', 'Oscuro']) {
        const row = rows.find((s) => s.screen === key + suffix)
        expect(row?.section?.endsWith('· tema oscuro'), key + suffix).toBe(suffix === 'Oscuro')
        expect(row?.tema === 'oscuro', key + suffix).toBe(suffix === 'Oscuro')
      }
    }
  })
})

describe('assertAccountKinds', () => {
  const accounts = { listo: { email: 'a', password: 'b' }, inicio: { email: 'c', password: 'd' } }

  it('accepts a kind for each account, and an empty sample with an empty kinds object', () => {
    expect(() => assertAccountKinds(accounts, { listo: 'open', inicio: 'ended' })).not.toThrow()
    expect(() => assertAccountKinds({}, {})).not.toThrow()
  })

  it('refuses a missing kinds object, a stale sample, without naming a credential', () => {
    for (const kinds of [undefined, null, [], 'open']) {
      expect(() => assertAccountKinds(accounts, kinds)).toThrow(/^the sample has no account_kinds, rerun scripts\/design\/sample-app\.sh$/)
    }
  })

  it('refuses an account with no kind', () => {
    expect(() => assertAccountKinds(accounts, { listo: 'open' })).toThrow(
      /^account inicio has no kind in account_kinds$/,
    )
  })

  it('refuses a kind that names no account', () => {
    expect(() => assertAccountKinds(accounts, { listo: 'open', inicio: 'ended', fantasma: 'open' })).toThrow(
      /^account_kinds names fantasma, which is not one of the sample's accounts$/,
    )
  })

  it('refuses a value other than open or ended, without printing it', () => {
    for (const value of ['closed', 'OPEN', '', 1, null, true]) {
      expect(() => assertAccountKinds(accounts, { listo: 'open', inicio: value })).toThrow(
        /^account inicio must have the kind open or ended$/,
      )
    }
  })
})

describe('the customer dark twins of the real screens.json', () => {
  const pantallas = resolve(process.cwd(), '..', 'docs/product/design-system/pantallas')
  // GH-526: twins whose dark drawing exists compare it; the others keep the light file until one is drawn.
  const ownDark = [
    ['Clientes', 'ClientesOscuro'],
    ['ClientesCompu', 'ClientesCompuOscuro'],
    ['ClienteFicha', 'ClienteFichaOscuro'],
    ['Cobro', 'CobroOscuro'],
  ] as const
  const lightKept = [['CobroCompu', 'CobroCompuOscuro']] as const
  const pairs = [...ownDark, ...lightKept]
  const entry = (key: string) => screens.screens.find((s) => s.screen === key)

  it('has each twin exactly once, compared against its own dark drawing, which exists', () => {
    for (const [light, dark] of ownDark) {
      expect(screens.screens.filter((s) => s.screen === dark).length, dark).toBe(1)
      expect(entry(dark)?.design, dark).toBe(dark)
      expect(readdirSync(pantallas), dark).toContain(`${dark}.dc.html`)
      expect(readdirSync(pantallas), light).toContain(`${light}.dc.html`)
    }
  })

  it('keeps the light file for a twin with no dark drawing, and that drawing is absent', () => {
    for (const [light, dark] of lightKept) {
      expect(screens.screens.filter((s) => s.screen === dark).length, dark).toBe(1)
      expect(entry(dark)?.design, dark).toBe(light)
      expect(readdirSync(pantallas), light).toContain(`${light}.dc.html`)
      expect(readdirSync(pantallas), dark).not.toContain(`${dark}.dc.html`)
    }
  })

  it('reaches each twin the way its light row does, forced to the dark theme and nothing else', () => {
    for (const [light, dark] of pairs) {
      const { screen: _lightName, ...lightRest } = entry(light) as Record<string, unknown>
      const { screen: _darkName, design: _design, tema, ...darkRest } = entry(dark) as Record<string, unknown>
      expect(tema, dark).toBe('oscuro')
      expect(darkRest, dark).toEqual(lightRest)
    }
  })

  it('captures each twin whole: no section, since these design files draw one screen', () => {
    for (const [, dark] of pairs) expect(entry(dark)?.section, dark).toBeUndefined()
  })

  it('puts each twin after its light row, so the sample app is in the state the light row found', () => {
    const names = screens.screens.map((s) => s.screen)
    for (const [light, dark] of pairs) expect(names.indexOf(dark), dark).toBeGreaterThan(names.indexOf(light))
  })

  it('refuses a twin whose design file does not exist', () => {
    expect(() => assertScreens([{ screen: 'ClientesOscuro', design: 'NoExiste', tema: 'oscuro', route: 'ruta' }])).toThrow(/ClientesOscuro/)
  })
})

describe.each(['pre_onboarding', 'imported', 'onboarding'] as const)('the %s account kind (GH-274, GH-303)', (kind) => {
  const accounts = { listo: {}, inicio: {}, capture: {} }
  const kinds = { listo: 'open', inicio: 'ended', capture: kind } as const

  it('is a kind the sample may write', () => {
    expect(() => assertAccountKinds(accounts, kinds)).not.toThrow()
  })

  it('refuses a kinds map that leaves its account out, naming the account', () => {
    expect(() => assertAccountKinds(accounts, { listo: 'open', inicio: 'ended' })).toThrow(
      /^account capture has no kind in account_kinds$/,
    )
  })

  it('refuses a kinds map with a key that is not an account', () => {
    expect(() => assertAccountKinds({ listo: {}, inicio: {} }, kinds)).toThrow(
      /^account_kinds names capture, which is not one of the sample's accounts$/,
    )
  })

  it('refuses a kind it does not know, without printing it', () => {
    expect(() => assertAccountKinds(accounts, { ...kinds, capture: `${kind}_x` })).toThrow(
      /^account capture must have the kind open or ended$/,
    )
  })

  it('refuses a Listo entry on it, by name and never by credential', () => {
    expect(() => assertSelectedAccounts([{ screen: 'OnboardingListo', account: 'capture' }], kinds)).toThrow(
      new RegExp(`^OnboardingListo: reaches OnboardingListo on an? ${kind} account, and a Listo entry needs an open one$`),
    )
  })

  it('serves read-only entries, and lets several of them share it', () => {
    expect(() =>
      assertSelectedAccounts(
        [
          { screen: 'Inicio', account: 'capture' },
          { screen: 'InicioOscuro', design: 'Inicio', account: 'capture', tema: 'oscuro' },
        ],
        kinds,
      ),
    ).not.toThrow()
  })

  it('does not weaken the rule that an open account serves only a Listo entry', () => {
    expect(() => assertSelectedAccounts([{ screen: 'Inicio', account: 'listo' }], kinds)).toThrow(
      /^Inicio: names an open account but does not reach OnboardingListo/,
    )
  })
})

describe('the capture accounts of sample_app.py (GH-274)', () => {
  const source = readFileSync(resolve(process.cwd(), '..', 'scripts/design/sample_app.py'), 'utf-8')
  const namesOf = (constant: string): string[] => {
    const declared = new RegExp(`^${constant} = \\(([^)]*)\\)`, 'm').exec(source)?.[1]
    if (declared === undefined) throw new Error(`sample_app.py declares no ${constant}`)
    return declared.match(/"[^"]+"/g)?.map((name) => name.slice(1, -1)) ?? []
  }

  it('declares the checklist and the imported accounts, apart from every other kind', () => {
    const groups = [
      'ONBOARDING_ACCOUNTS',
      'ENDED_ONBOARDING_ACCOUNTS',
      'PRE_ONBOARDING_ACCOUNTS',
      'IMPORTED_ACCOUNTS',
      'ONBOARDING_FRAME_ACCOUNTS',
    ]
    expect(namesOf('PRE_ONBOARDING_ACCOUNTS')).toEqual(['checklist', 'primera_vez'])
    expect(namesOf('ONBOARDING_FRAME_ACCOUNTS')).toEqual(['en_curso', 'completo'])
    expect(namesOf('IMPORTED_ACCOUNTS')).toEqual(['importada'])
    const all = groups.flatMap(namesOf)
    expect(new Set(all).size).toBe(all.length)
  })

  it('names each of them on exactly its three rows, each cropped to a label of its own drawing', () => {
    const rows = screens.screens as { screen: string; account?: string; design?: string; section?: string }[]
    const named = (account: string) => rows.filter((r) => r.account === account).map((r) => r.screen)
    expect(named('checklist')).toEqual(['InicioChecklist', 'InicioChecklistCompu', 'InicioChecklistOscuro'])
    expect(named('importada')).toEqual(['InicioImportado', 'InicioImportadoCompu', 'InicioImportadoOscuro'])
    expect(named('primera_vez')).toEqual(['InicioPrimeraVez', 'InicioPrimeraVezCompu', 'InicioPrimeraVezOscuro'])
    expect(named('en_curso')).toEqual(['InicioOnboardingEnCurso', 'InicioOnboardingEnCursoCompu', 'InicioOnboardingEnCursoOscuro'])
    expect(named('completo')).toEqual(['InicioOnboardingCompleto', 'InicioOnboardingCompletoCompu', 'InicioOnboardingCompletoOscuro'])
    for (const r of rows.filter((x) => ['checklist', 'importada', 'primera_vez', 'en_curso', 'completo'].includes(x.account ?? ''))) {
      expect(typeof r.section, r.screen).toBe('string')
    }
  })

  it('refuses a first-run row whose label is not in its drawing, or occurs twice', () => {
    const row = { screen: 'InicioChecklist', route: 'ruta', account: 'checklist' }
    expect(() => assertScreens([{ ...row, section: 'Una etiqueta que no está dibujada' }])).toThrow(
      /^InicioChecklist: section "Una etiqueta que no está dibujada" is not in InicioChecklist\.dc\.html$/,
    )
    expect(() => assertScreens([{ screen: 'InicioHoyCompu', design: 'InicioCompu', route: 'ruta', section: 'Hoy' }])).toThrow(
      /InicioHoyCompu: section "Hoy" occurs \d+ times in InicioCompu\.dc\.html, expected exactly once/,
    )
  })

  it('names none of them on a Listo entry of the real registry', () => {
    const capture = [...namesOf('PRE_ONBOARDING_ACCOUNTS'), ...namesOf('IMPORTED_ACCOUNTS'), ...namesOf('ONBOARDING_FRAME_ACCOUNTS')]
    const real = Object.fromEntries(capture.map((name) => [name, 'imported' as const]))
    const listo = screens.screens.filter((s) => (s as { design?: string }).design === 'OnboardingListo' || s.screen === 'OnboardingListo')
    expect(listo.length).toBeGreaterThan(0)
    for (const entry of listo) expect(capture).not.toContain((entry as { account?: string }).account)
    expect(() => assertSelectedAccounts(screens.screens, { ...real, ...Object.fromEntries(namesOf('ONBOARDING_ACCOUNTS').map((n) => [n, 'open' as const])), inicio: 'ended' })).not.toThrow()
  })
})
