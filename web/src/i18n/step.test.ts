import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { loadBundle } from '../../scripts/i18n/loadBundle.ts'
import { MissingKeyError } from './resolve.ts'
import { isConvertedRow, resolveStep, rowProblems, stepText } from './step.ts'

const en = loadBundle('en')

describe('stepText', () => {
  test('a key that resolves gives its English', () => {
    expect(stepText('common:close', en)).toBe('Close')
  })

  test.each(['comon:close', 'kg:5'])('a key-shaped text that does not resolve throws: %s', (text) => {
    expect(() => stepText(text, en)).toThrow(MissingKeyError)
  })

  test.each(['Common:close', 'common:', 'http://x', 'Save changes'])('any other text comes back unchanged: %s', (text) => {
    expect(stepText(text, en)).toBe(text)
  })
})

/** One row with a step of every kind, every named field a resolving key. */
const CONVERTED = {
  screen: 'Pantalla',
  steps: [
    { click: 'common:home' },
    { press: 'common:done' },
    { fill: { label: 'common:variety', value: 'common:close' } },
    { select: { label: 'common:sales', index: 1 } },
    { wait: 'common:catalog' },
    { offline: true },
  ],
}

type Row = { screen: string; steps: Record<string, unknown>[] }

/** The same row with one field replaced by a text that is not a key. */
function withField(index: number, field: string, text: string): Row {
  const steps = CONVERTED.steps.map((step) => structuredClone(step)) as Record<string, unknown>[]
  const step = steps[index] as Record<string, unknown>
  if (field === 'fill.label') (step['fill'] as Record<string, unknown>)['label'] = text
  else step[field] = text
  return { screen: CONVERTED.screen, steps }
}

const ROW_TEXTS = ['Home', 'Done', 'Product', 'Sales', 'Catalog', 'Close', 'Plain text', 'comon:close']

describe('rowProblems', () => {
  test('a fully converted row that resolves has no problems', () => {
    expect(rowProblems(CONVERTED, en)).toEqual([])
  })

  test('a row with no key-shaped field is not converted and gives nothing', () => {
    const row = { screen: 'A', steps: [{ click: 'Save' }, { fill: { label: 'Name', value: 'common:close' } }] }
    expect(rowProblems(row, en)).toEqual([])
    expect(rowProblems({ screen: 'A' }, en)).toEqual([])
  })

  test.each([
    [0, 'click'],
    [1, 'press'],
    [2, 'fill.label'],
    [4, 'wait'],
  ])('a mixed row fails on the field that is plain text: step %i %s', (index, field) => {
    const problems = rowProblems(withField(index, field, 'Plain text'), en)
    expect(problems).toEqual([`Pantalla: step ${index} ${field} is not a resolving key`])
    for (const problem of problems) for (const text of ROW_TEXTS) expect(problem).not.toContain(text)
  })

  test.each([
    [0, 'click'],
    [1, 'press'],
    [2, 'fill.label'],
    [4, 'wait'],
  ])('a typo key fails on the field that holds it: step %i %s', (index, field) => {
    const problems = rowProblems(withField(index, field, 'comon:close'), en)
    expect(problems).toEqual([`Pantalla: step ${index} ${field} is not a resolving key`])
    for (const problem of problems) for (const text of ROW_TEXTS) expect(problem).not.toContain(text)
  })

  test('one message per failing field, in step order', () => {
    const row = { screen: 'B', steps: [{ click: 'common:home' }, { press: 'Save' }, { wait: 'kg:5' }] }
    expect(rowProblems(row, en)).toEqual([
      'B: step 1 press is not a resolving key',
      'B: step 2 wait is not a resolving key',
    ])
  })

  test('fill.value, select and offline are never judged', () => {
    const row = {
      screen: 'C',
      steps: [{ click: 'common:home' }, { fill: { label: 'common:variety', value: 'kg:5' } }, { select: { label: 'x', index: 0 } }, { offline: true }],
    }
    expect(rowProblems(row, en)).toEqual([])
  })
})

describe('isConvertedRow', () => {
  test('any key-shaped click, press, wait or fill.label converts a row; fill.value alone does not', () => {
    expect(isConvertedRow(CONVERTED)).toBe(true)
    expect(isConvertedRow(withField(0, 'click', 'comon:close'))).toBe(true)
    expect(isConvertedRow({ screen: 'A', steps: [{ fill: { label: 'common:home', value: 'v' } }] })).toBe(true)
    expect(isConvertedRow({ screen: 'A', steps: [{ fill: { label: 'Name', value: 'common:close' } }, { select: { label: 'common:home', index: 0 } }] })).toBe(false)
    expect(isConvertedRow({ screen: 'A' })).toBe(false)
  })
})

describe('resolveStep', () => {
  test('a converted step resolves click, press, wait and fill.label', () => {
    expect(resolveStep({ click: 'common:close' }, en)).toEqual({ click: 'Close' })
    expect(resolveStep({ press: 'common:close' }, en)).toEqual({ press: 'Close' })
    expect(resolveStep({ wait: 'common:close' }, en)).toEqual({ wait: 'Close' })
    expect(resolveStep({ fill: { label: 'common:close', value: 'v' } }, en)).toEqual({ fill: { label: 'Close', value: 'v' } })
  })

  test('a key-shaped fill.value, a select and offline come back unchanged', () => {
    expect(resolveStep({ fill: { label: 'Name', value: 'common:close' } }, en)).toEqual({
      fill: { label: 'Name', value: 'common:close' },
    })
    const select = { select: { label: 'common:close', index: 2 } }
    expect(resolveStep(select, en)).toEqual(select)
    expect(resolveStep({ offline: true }, en)).toEqual({ offline: true })
  })

  test('a plain text step is returned as it is', () => {
    expect(resolveStep({ click: 'Save' }, en)).toEqual({ click: 'Save' })
  })

  test('a key that does not resolve throws', () => {
    expect(() => resolveStep({ click: 'comon:close' }, en)).toThrow(MissingKeyError)
  })
})

describe('under plain node', () => {
  test('step.ts and loadBundle.ts load natively and resolve a key', { timeout: 30_000 }, () => {
    const step = pathToFileURL(join(import.meta.dirname, 'step.ts')).href
    const load = pathToFileURL(join(import.meta.dirname, '../../scripts/i18n/loadBundle.ts')).href
    const script = `import { stepText } from ${JSON.stringify(step)}
import { loadBundle } from ${JSON.stringify(load)}
process.stdout.write(stepText('common:close', loadBundle('en')))`
    let stdout = ''
    try {
      stdout = execFileSync(process.execPath, ['--input-type=module', '-e', script], { timeout: 20_000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (error) {
      const stderr = (error as { stderr?: Buffer | string }).stderr
      throw new Error(`node could not run step.ts: ${String(stderr)}`)
    }
    expect(stdout).toBe('Close')
  })
})
