import { describe, expect, test } from 'vitest'
import { RULES, type Rule, type Violation } from '../violation.ts'
import {
  AREA_ISSUES,
  diffOffenders,
  FILES,
  OFFENDERS,
  offendersOfCell,
  parseOffenders,
  type Offender,
} from './index.ts'

/** Every rule's file empty but `rule`'s: the shipped files list real offenders and change with the code. */
function filesWith(rule: Rule, entries: unknown[]): Record<Rule, unknown> {
  const empty = Object.fromEntries(RULES.map((name) => [name, []]))
  return { ...FILES, ...empty, [rule]: entries }
}

const violation = (extra: Partial<Violation> = {}): Violation => ({
  screen: 'Entrar',
  size: '320x568',
  theme: 'claro',
  rule: 'touch-target',
  target: 'button:Sign in',
  ...extra,
})

const entry = (extra: Record<string, unknown> = {}) => ({
  screen: 'Entrar',
  rule: 'touch-target',
  target: 'button:Sign in',
  issue: 49,
  ...extra,
})

describe('parseOffenders', () => {
  test('the shipped files parse', () => {
    expect(() => parseOffenders()).not.toThrow()
    expect(OFFENDERS).toEqual(parseOffenders())
  })

  test('an entry without sizes or themes expands into every cell', () => {
    const cells = parseOffenders(filesWith('touch-target', [entry()]))
    expect(cells).toHaveLength(8)
    expect(new Set(cells.map((c) => `${c.size}/${c.theme}`)).size).toBe(8)
  })

  test('listed sizes and themes expand to exactly those cells', () => {
    const cells = parseOffenders(filesWith('touch-target', [entry({ sizes: ['320x568'], themes: ['oscuro'] })]))
    expect(cells).toEqual([{ ...violation({ theme: 'oscuro' }), issue: 49 }])
  })

  test('refuses an entry with no issue, a non-integer or a non-positive one', () => {
    for (const issue of [undefined, 0, -3, 1.5, '49', null]) {
      expect(() => parseOffenders(filesWith('touch-target', [entry({ issue })]))).toThrow(/issue/)
    }
  })

  test('refuses an issue outside the fixed area map', () => {
    expect(AREA_ISSUES).toEqual([45, 46, 47, 48, 49, 59, 60, 78])
    expect(() => parseOffenders(filesWith('touch-target', [entry({ issue: 12 })]))).toThrow(/area map/)
  })

  test('refuses an unknown screen, rule, size or theme', () => {
    expect(() => parseOffenders(filesWith('touch-target', [entry({ screen: 'Nope' })]))).toThrow(/screen/)
    expect(() => parseOffenders(filesWith('touch-target', [entry({ rule: 'nope' })]))).toThrow(/rule/)
    expect(() => parseOffenders(filesWith('touch-target', [entry({ sizes: ['100x100'] })]))).toThrow(/sizes/)
    expect(() => parseOffenders(filesWith('touch-target', [entry({ themes: ['sepia'] })]))).toThrow(/themes/)
  })

  test('refuses a rule that sits in another rule’s file', () => {
    expect(() => parseOffenders(filesWith('input-font', [entry()]))).toThrow(/file of input-font/)
  })

  test('a page rule has an empty target and an element rule a non-empty one', () => {
    expect(() =>
      parseOffenders(filesWith('h-scroll', [entry({ rule: 'h-scroll', target: 'main' })])),
    ).toThrow(/page rule/)
    expect(() => parseOffenders(filesWith('touch-target', [entry({ target: '' })]))).toThrow(/element rule/)
    expect(parseOffenders(filesWith('h-scroll', [entry({ rule: 'h-scroll', target: '', issue: 59 })]))).toHaveLength(8)
  })

  test('an entry may carry a reason, and every cell it expands to keeps it', () => {
    const cells = parseOffenders(filesWith('touch-target', [entry({ reason: 'the button measures 40x30' })]))
    expect(cells).toHaveLength(8)
    expect(cells.every((cell) => cell.reason === 'the button measures 40x30')).toBe(true)
    expect(parseOffenders(filesWith('touch-target', [entry()]))[0]).not.toHaveProperty('reason')
  })

  test('refuses a reason that is empty, blank or not a string', () => {
    for (const reason of ['', '   ', 7, null, ['x']]) {
      expect(() => parseOffenders(filesWith('touch-target', [entry({ reason })]))).toThrow(
        /touch-target\.json #0: reason is not a non-empty string/,
      )
    }
  })

  test('refuses a key outside the entry’s own', () => {
    expect(() => parseOffenders(filesWith('touch-target', [entry({ note: 'x' })]))).toThrow(
      /touch-target\.json #0: unknown key note/,
    )
  })

  test('refuses two entries that expand to the same cell', () => {
    expect(() =>
      parseOffenders(filesWith('touch-target', [entry(), entry({ sizes: ['320x568'] })])),
    ).toThrow(/twice/)
  })
})

describe('diffOffenders', () => {
  const listed: Offender = { ...violation(), issue: 49 }

  test('a listed failure is allowed and leaves nothing over', () => {
    expect(diffOffenders([listed], [violation()])).toEqual({ unlisted: [], fixedButListed: [] })
  })

  test('a new offender is unlisted', () => {
    const fresh = violation({ target: 'button:Otro' })
    expect(diffOffenders([listed], [violation(), fresh]).unlisted).toEqual([fresh])
  })

  test('a fixed entry left listed is reported', () => {
    expect(diffOffenders([listed], []).fixedButListed).toEqual([listed])
  })

  test('matches on all five fields: any one differing is a new offender and a fixed entry', () => {
    const variants: Partial<Violation>[] = [
      { screen: 'Home' },
      { size: '375x812' },
      { theme: 'oscuro' },
      { rule: 'input-font' },
      { target: 'button:Entra' },
    ]
    for (const variant of variants) {
      const diff = diffOffenders([listed], [violation(variant)])
      expect(diff.unlisted).toHaveLength(1)
      expect(diff.fixedButListed).toEqual([listed])
    }
  })

  test('the same failure reported twice counts once', () => {
    const fresh = violation({ target: 'button:Otro' })
    expect(diffOffenders([], [fresh, fresh]).unlisted).toEqual([fresh])
  })
})

describe('offendersOfCell', () => {
  test('keeps only the entries of one screen, size and theme', () => {
    const cells = parseOffenders(filesWith('touch-target', [entry()]))
    const mine = offendersOfCell(cells, { screen: 'Entrar', size: '375x812', theme: 'oscuro' })
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({ size: '375x812', theme: 'oscuro' })
    expect(offendersOfCell(cells, { screen: 'Home', size: '375x812', theme: 'oscuro' })).toEqual([])
  })
})

describe('the offender files', () => {
  const files = import.meta.glob('./*.json', { eager: true })

  test('there is a file for every rule and none for a rule that does not exist', () => {
    const names = Object.keys(files)
      .map((path) => path.replace(/^\.\//, '').replace(/\.json$/, ''))
      .sort()
    expect(names).toEqual([...RULES].sort())
  })

  test('the table holds one entry per rule', () => {
    expect(Object.keys(FILES).sort()).toEqual([...RULES].sort())
  })
})

/**
 * The rows new to the screens registry whose real cells came in with the change that added
 * them (`docs/product/gate.md`, "A new registry row brings its cells"). Each states the
 * fault its entries observed. When an area issue removes a screen's last entry, its name goes.
 */
const NEW_ROW_SCREENS = ['InicioChecklist', 'InicioImportado']

/** The cells of `screen` that state no fault. */
function withoutReason(offenders: readonly Offender[], screen: string): Offender[] {
  return offenders.filter(
    (offender) => offender.screen === screen && (offender.reason === undefined || offender.reason.trim() === ''),
  )
}

describe('the offenders of a row new to the registry', () => {
  test('the check names the cells that state no fault', () => {
    const stated: Offender = { ...violation({ screen: 'InicioChecklist' }), issue: 45, reason: 'measures 40x30' }
    const silent: Offender = { ...stated, target: 'button:Other' }
    delete silent.reason
    const blank: Offender = { ...stated, target: 'button:Blank', reason: '  ' }
    expect(withoutReason([stated, silent, blank], 'InicioChecklist')).toEqual([silent, blank])
    expect(withoutReason([silent], 'InicioImportado')).toEqual([])
  })

  for (const screen of NEW_ROW_SCREENS) {
    test(`${screen} is listed`, () => {
      expect(OFFENDERS.some((offender) => offender.screen === screen)).toBe(true)
    })

    test(`every ${screen} entry states the fault the check observed`, () => {
      expect(withoutReason(OFFENDERS, screen)).toEqual([])
    })
  }
})

/**
 * Collect's walked sheet states: the sheet draws them (ADR-0062), so the faults of its own markup
 * are fixed, not listed. The one exception is Save's `pending-state`: a pending state needs a
 * word the idle button does not say, and this change adds no visible text.
 */
const COLLECT_SHEET_STATES = ['Cobro', 'CobroDesdeClientes', 'CobroDesdeInicio']

/** The entries that name one of `screens`, other than the allowed `pending-state` of Save. */
function sheetEntries(offenders: readonly Offender[], screens: readonly string[]): Offender[] {
  return offenders.filter(
    (offender) =>
      screens.includes(offender.screen) && !(offender.rule === 'pending-state' && offender.target === 'button:Save'),
  )
}

describe("Collect's walked sheet states", () => {
  test('no entry names them but the pending state of Save', () => {
    expect(sheetEntries(OFFENDERS, COLLECT_SHEET_STATES)).toEqual([])
  })

  test('the check rejects an entry that does name one of them', () => {
    const listed: Offender = { ...violation({ screen: 'CobroDesdeClientes', rule: 'autocomplete', target: 'textbox:Amount' }), issue: 46 }
    const pending: Offender = { ...listed, rule: 'pending-state', target: 'button:Save' }
    expect(sheetEntries([listed, pending], COLLECT_SHEET_STATES)).toEqual([listed])
    expect(sheetEntries([{ ...listed, screen: 'Entrar' }], COLLECT_SHEET_STATES)).toEqual([])
  })
})
