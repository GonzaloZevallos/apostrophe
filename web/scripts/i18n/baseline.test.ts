import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { counted } from '../../src/copy/baselineArgs.ts'
import {
  collectEntries,
  driftProblems,
  parseBaseline,
  runBaseline,
  serialize,
  updatedEntries,
  type Modules,
} from './baseline.ts'
import { pluralProblems } from './plurals.ts'
import * as sample from './__fixtures__/sample.ts'

const SAMPLE: Modules = { 'sample.ts': sample }

/** A fresh path for the baseline file; it does not exist yet. */
function newFile(): string {
  return join(mkdtempSync(join(tmpdir(), 'baseline-')), 'en.baseline.json')
}

describe('collectEntries', () => {
  test('records strings, nested objects and arrays by path, and each function once per row, sorted', () => {
    expect(collectEntries(SAMPLE).map(({ source, args, text }) => [source, args, text])).toEqual([
      ['sample.ts:GROUP.greet', ['Ana'], 'Hello Ana'],
      ['sample.ts:GROUP.hello', null, 'Hello'],
      ['sample.ts:GROUP.nested.bye', null, 'Bye'],
      ['sample.ts:LANGUAGE', null, 'en'],
      ['sample.ts:LIST[0]', null, 'first'],
      ['sample.ts:LIST[1]', null, 'second'],
      ['sample.ts:TITLE', null, 'Sample title'],
      ['sample.ts:salesCount', [0], '0 sales'],
      ['sample.ts:salesCount', [1], '1 sale'],
      ['sample.ts:salesCount', [2], '2 sales'],
      ['sample.ts:statusOf', ['closed', 'late'], 'closed: late'],
      ['sample.ts:statusOf', ['open', null], 'open'],
    ])
  })

  test('skips limits.ts, the registries and the table itself', () => {
    const modules: Modules = {
      'limits.ts': { SAMPLES: { date: '28/09' }, LIMIT: 80 },
      'a.ts': { LIMITED_COPY: [{ kind: 'help', text: 'x' }], LONG_REFUSALS: ['y'], BASELINE_ARGS: {}, KEPT: 'kept' },
    }
    expect(collectEntries(modules).map((entry) => entry.source)).toEqual(['a.ts:KEPT'])
  })

  describe('the exports a module names in MOVED_TO_KEYS', () => {
    const moved = (): Record<string, unknown> => ({
      NAMESPACE: 'common',
      MOVED_TO_KEYS: ['OLD'] as const,
      OLD: { home: 'Home', greet: (name: string) => `Hello ${name}` },
      KEPT: 'kept',
      BASELINE_ARGS: { 'OLD.greet': [['Ana']] },
    })

    test('are not recorded, and their BASELINE_ARGS rows are not an error, but the rest still is', () => {
      expect(collectEntries({ 'a.ts': moved() }).map((entry) => entry.source)).toEqual(['a.ts:KEPT'])
    })

    test('are not rendered for drift: a recorded entry of a moved export is left to the keyed check', () => {
      const committed = [{ source: 'a.ts:OLD.home', args: null, text: 'Another' }]

      expect(driftProblems({ 'a.ts': moved() }, committed)).toEqual([])
    })

    test('a module without MOVED_TO_KEYS skips nothing', () => {
      const plain = Object.fromEntries(Object.entries(moved()).filter(([name]) => name !== 'MOVED_TO_KEYS'))

      expect(collectEntries({ 'a.ts': plain }).map((entry) => entry.source)).toEqual(['a.ts:KEPT', 'a.ts:OLD.greet', 'a.ts:OLD.home'])
    })

    test('only the names it lists: a function outside the list still needs its row', () => {
      const mod = { ...moved(), LATER: { f: () => 'x' } }

      expect(() => collectEntries({ 'a.ts': mod })).toThrow('a.ts:LATER.f: a function with no BASELINE_ARGS row')
    })

    test('a row for a name that is neither a moved export nor a function is still an error', () => {
      const mod = { ...moved(), BASELINE_ARGS: { 'OLD.greet': [['Ana']], KEPT: [[]] } }

      expect(() => collectEntries({ 'a.ts': mod })).toThrow('a.ts:KEPT: a BASELINE_ARGS row for something that is not a function')
    })
  })

  test('keeps null and undefined apart in the recorded arguments', () => {
    const modules: Modules = {
      'a.ts': { maybe: (x?: string | null) => `${x}`, BASELINE_ARGS: { maybe: [[null], [undefined]] } },
    }
    const args = collectEntries(modules).map((entry) => JSON.stringify(entry.args))
    expect(new Set(args).size).toBe(2)
  })

  test('records a key with a dot (a refusal code) as a quoted step, and drift finds it again', () => {
    const modules: Modules = { 'a.ts': { BY_CODE: { 'stock.gone': 'Gone', plain: 'Plain' } } }
    const entries = collectEntries(modules)
    expect(entries.map((entry) => entry.source)).toEqual(['a.ts:BY_CODE.plain', 'a.ts:BY_CODE["stock.gone"]'])
    expect(driftProblems(modules, entries)).toEqual([])
    const reworded: Modules = { 'a.ts': { BY_CODE: { 'stock.gone': 'Away', plain: 'Plain' } } }
    expect(driftProblems(reworded, entries)).toEqual(['a.ts:BY_CODE["stock.gone"]: no longer renders its baseline text'])
  })

  describe('stops, naming the export path, on', () => {
    const stop = (mod: Record<string, unknown>): string => {
      try {
        collectEntries({ 'a.ts': mod })
      } catch (error) {
        return error instanceof Error ? error.message : 'not an Error'
      }
      return 'did not stop'
    }

    test('a function with no row', () => {
      expect(stop({ GROUP: { later: () => 'x' } })).toBe('a.ts:GROUP.later: a function with no BASELINE_ARGS row')
    })

    test('a function whose row list is empty', () => {
      expect(stop({ later: () => 'x', BASELINE_ARGS: { later: [] } })).toContain('a.ts:later: a function with no')
    })

    test('a call that throws', () => {
      const boom = (): string => {
        throw new Error('boom')
      }
      expect(stop({ boom, BASELINE_ARGS: { boom: [[]] } })).toBe('a.ts:boom: the call threw (boom)')
    })

    test('a call that returns something that is not a string', () => {
      expect(stop({ size: () => 3, BASELINE_ARGS: { size: [[]] } })).toBe('a.ts:size: the call returned a number, not a string')
    })

    test.each([
      ['a number', 3, 'number'],
      ['a boolean', true, 'boolean'],
      ['undefined', undefined, 'undefined'],
      ['null', null, 'null'],
    ])('an export that is %s', (_name, value, kind) => {
      expect(stop({ COUNT: value })).toBe(`a.ts:COUNT: an export of kind ${kind} is not copy`)
    })

    test('a number nested in an object', () => {
      expect(stop({ GROUP: { n: 3 } })).toBe('a.ts:GROUP.n: an export of kind number is not copy')
    })

    test('a row for a name that is not a function', () => {
      expect(stop({ TITLE: 'x', BASELINE_ARGS: { TITLE: [[]] } })).toBe('a.ts:TITLE: a BASELINE_ARGS row for something that is not a function')
    })

    test('two rows with the same arguments', () => {
      expect(stop({ f: () => 'x', BASELINE_ARGS: { f: [[1], [1]] } })).toBe('a.ts:f: two rows call it with the same arguments')
    })

    test('an argument that JSON cannot hold', () => {
      expect(stop({ f: () => 'x', BASELINE_ARGS: { f: [[() => 1]] } })).toBe('a.ts:f: an argument of kind function cannot be recorded as JSON')
    })
  })
})

describe('runBaseline', () => {
  test('first write: creates the file with every entry, one per line', () => {
    const file = newFile()
    expect(runBaseline({ modules: SAMPLE, file, mode: 'default' })).toEqual({ action: 'wrote', problems: [] })
    expect(parseBaseline(readFileSync(file, 'utf8'))).toEqual(collectEntries(SAMPLE))
    expect(readFileSync(file, 'utf8').split('\n')).toHaveLength(collectEntries(SAMPLE).length + 3)
  })

  test('default on an existing file is a check: it reports a reworded text and writes nothing', () => {
    const file = newFile()
    runBaseline({ modules: SAMPLE, file, mode: 'default' })
    const before = readFileSync(file, 'utf8')
    const reworded: Modules = { 'sample.ts': { ...sample, TITLE: 'Another title' } }
    const result = runBaseline({ modules: reworded, file, mode: 'default' })
    expect(result).toEqual({ action: 'checked', problems: ['sample.ts:TITLE: no longer renders its baseline text'] })
    expect(readFileSync(file, 'utf8')).toBe(before)
  })

  test('default on an unchanged copy has no problems', () => {
    const file = newFile()
    runBaseline({ modules: SAMPLE, file, mode: 'default' })
    expect(runBaseline({ modules: SAMPLE, file, mode: 'default' })).toEqual({ action: 'checked', problems: [] })
  })

  test('update rewrites the text of an entry whose source exists, and adds and deletes nothing', () => {
    const file = newFile()
    runBaseline({ modules: SAMPLE, file, mode: 'default' })
    const committed = parseBaseline(readFileSync(file, 'utf8'))
    const { GROUP: _moved, ...rest } = sample
    const changed: Modules = {
      'sample.ts': { ...rest, TITLE: 'Another title', BRAND_NEW: 'New text', BASELINE_ARGS: { ...sample.BASELINE_ARGS } },
    }
    // GROUP no longer exists (its text moved), so its function row is stale: drop it.
    const { 'GROUP.greet': _row, ...rows } = sample.BASELINE_ARGS
    const modules: Modules = { 'sample.ts': { ...changed['sample.ts'], BASELINE_ARGS: rows } }

    expect(runBaseline({ modules, file, mode: 'update' })).toEqual({ action: 'updated', problems: [] })
    const updated = parseBaseline(readFileSync(file, 'utf8'))
    expect(updated.map((entry) => entry.source)).toEqual(committed.map((entry) => entry.source))
    expect(updated.find((entry) => entry.source === 'sample.ts:TITLE')?.text).toBe('Another title')
    expect(updated.find((entry) => entry.source === 'sample.ts:GROUP.hello')?.text).toBe('Hello')
    expect(updated.some((entry) => entry.source.endsWith('BRAND_NEW'))).toBe(false)
  })

  test('update refuses to write a file that does not exist, since it never adds an entry', () => {
    const file = newFile()
    expect(() => runBaseline({ modules: SAMPLE, file, mode: 'update' })).toThrow('--update only rewrites existing entries')
    expect(existsSync(file)).toBe(false)
  })

  test('update leaves the file byte for byte when nothing changed', () => {
    const file = newFile()
    runBaseline({ modules: SAMPLE, file, mode: 'default' })
    writeFileSync(file, readFileSync(file, 'utf8').replace(/\n$/, '\n\n'))
    const before = readFileSync(file, 'utf8')
    runBaseline({ modules: SAMPLE, file, mode: 'update' })
    expect(readFileSync(file, 'utf8')).toBe(before)
  })

  test('stops before touching the file when a function has no row', () => {
    const file = newFile()
    runBaseline({ modules: SAMPLE, file, mode: 'default' })
    const before = readFileSync(file, 'utf8')
    const modules: Modules = { 'sample.ts': { ...sample, extra: () => 'x' } }
    expect(() => runBaseline({ modules, file, mode: 'update' })).toThrow('sample.ts:extra: a function with no BASELINE_ARGS row')
    expect(readFileSync(file, 'utf8')).toBe(before)
  })

  test('rejects a file that is not an array of entries', () => {
    const file = newFile()
    writeFileSync(file, '{"source": "x"}')
    expect(() => runBaseline({ modules: SAMPLE, file, mode: 'default' })).toThrow('not an array')
    writeFileSync(file, '[{"source": "x", "args": 3, "text": "t"}]')
    expect(() => runBaseline({ modules: SAMPLE, file, mode: 'default' })).toThrow('not {source, args, text}')
  })
})

describe('driftProblems', () => {
  const committed = collectEntries(SAMPLE)

  test('passes when every entry renders its text', () => {
    expect(driftProblems(SAMPLE, committed)).toEqual([])
  })

  test('names the function and the arguments of a reworded function, never the text', () => {
    const reworded: Modules = { 'sample.ts': { ...sample, GROUP: { ...sample.GROUP, greet: (name: string) => `Hi ${name}` } } }
    expect(driftProblems(reworded, committed)).toEqual([
      'sample.ts:GROUP.greet ["Ana"]: no longer renders its baseline text',
    ])
  })

  test('skips an entry whose export no longer exists: the text moved', () => {
    const { TITLE: _moved, ...rest } = sample
    expect(driftProblems({ 'sample.ts': rest }, committed)).toEqual([])
    expect(driftProblems({}, committed)).toEqual([])
  })

  test('stops when an export changed from a string to a function', () => {
    const changed: Modules = { 'sample.ts': { ...sample, TITLE: () => 'x' } }
    expect(() => driftProblems(changed, committed)).toThrow('sample.ts:TITLE: recorded as a string, now a function')
  })

  test('compares parsed JSON, not the file text', () => {
    const spaced = JSON.stringify(committed, null, 4)
    expect(driftProblems(SAMPLE, parseBaseline(spaced))).toEqual([])
    expect(parseBaseline(serialize(committed))).toEqual(parseBaseline(spaced))
  })

  test('calls a function with undefined where the entry recorded it', () => {
    const modules: Modules = { 'a.ts': { f: (x?: string) => `${x}`, BASELINE_ARGS: { f: [[undefined], ['a']] } } }
    expect(driftProblems(modules, collectEntries(modules))).toEqual([])
    const texts = collectEntries(modules).map((entry) => entry.text)
    expect(texts.sort()).toEqual(['a', 'undefined'])
  })
})

describe('updatedEntries', () => {
  test('keeps the order and the arguments of the committed entries', () => {
    const committed = collectEntries(SAMPLE)
    expect(updatedEntries(SAMPLE, committed)).toEqual(committed)
  })
})

describe('pluralProblems', () => {
  test('passes on the sample, whose plural is wrapped in counted and whose other functions are not', () => {
    expect(pluralProblems(SAMPLE)).toEqual([])
  })

  test('names a plural function whose rows are not wrapped in counted', () => {
    const modules: Modules = {
      'a.ts': { sales: (n: number) => (n === 1 ? `${n} sale` : `${n} sales`), BASELINE_ARGS: { sales: [[3]] } },
    }
    expect(pluralProblems(modules)).toEqual(['a.ts:sales: its text depends on a count but its rows are not wrapped in counted()'])
  })

  test('names a function wrapped in counted whose text does not depend on the count', () => {
    const modules: Modules = {
      'a.ts': { total: (n: number) => `Total ${n}`, BASELINE_ARGS: { total: counted((n) => [n]) } },
    }
    expect(pluralProblems(modules)).toEqual(['a.ts:total: wrapped in counted() but its text does not change between 1 and 2'])
  })

  test('takes the other arguments from the first row and tries every number position', () => {
    const modules: Modules = {
      'a.ts': {
        pair: (label: string, n: number) => (label === 'x' && n !== 1 ? `${n} xs` : `${n} ${label}`),
        BASELINE_ARGS: { pair: [['x', 5], ['y', 5]] },
      },
    }
    expect(pluralProblems(modules)).toEqual(['a.ts:pair: its text depends on a count but its rows are not wrapped in counted()'])
  })

  test('ignores digits: a count that only changes the number is not a plural', () => {
    const modules: Modules = { 'a.ts': { total: (n: number) => `Total ${n}`, BASELINE_ARGS: { total: [[3]] } } }
    expect(pluralProblems(modules)).toEqual([])
  })
})
