import { describe, expect, expectTypeOf, test } from 'vitest'
import { baselineArgs, counted, isCounted, type BaselineArgs, type Check } from './baselineArgs.ts'

/** The shape of a copy module: a union, a nullable position, a free string, a count. */
interface Module {
  readonly LIMITED_COPY: readonly string[]
  readonly TEXT: { readonly pick: (kind: 'a' | 'b', note: string | null) => string }
  readonly free: (name: string, n: number) => string
  readonly maybe: (note?: string) => string
}

type Table = BaselineArgs<Module>

const complete = {
  'TEXT.pick': [
    ['a', null],
    ['b', 'x'],
  ],
  free: [['Ana', 1]],
  maybe: [[undefined], ['x']],
} as const

describe('BaselineArgs', () => {
  test('is keyed by the export path of each function, and not by strings or registries', () => {
    expectTypeOf<keyof Table>().toEqualTypeOf<'TEXT.pick' | 'free' | 'maybe'>()
  })

  test('types each row as the function parameters', () => {
    expectTypeOf<Table['TEXT.pick']>().toEqualTypeOf<readonly (readonly [kind: 'a' | 'b', note: string | null])[]>()
  })
})

describe('Check', () => {
  test('adds nothing to a table that covers every union member and every nullable position', () => {
    expectTypeOf<Check<Module, typeof complete>>().toEqualTypeOf<unknown>()
  })

  test('names the union member a table leaves out', () => {
    const missingMember = {
      ...complete,
      'TEXT.pick': [
        ['a', null],
        ['a', 'x'],
      ],
    } as const
    expectTypeOf<Check<Module, typeof missingMember>>().toEqualTypeOf<{ missing: { 'TEXT.pick': { 0: 'b' } } }>()
  })

  test('names the nullable position a table leaves out', () => {
    const missingNull = {
      ...complete,
      'TEXT.pick': [
        ['a', 'y'],
        ['b', 'x'],
      ],
    } as const
    expectTypeOf<Check<Module, typeof missingNull>>().toEqualTypeOf<{ missing: { 'TEXT.pick': { 1: null } } }>()
  })

  test('asks for undefined where a parameter is optional', () => {
    const missingUndefined = { ...complete, maybe: [['x']] } as const
    expectTypeOf<Check<Module, typeof missingUndefined>>().toEqualTypeOf<{ missing: { maybe: { 0: undefined } } }>()
  })

  test('rejects a row for a path that is not a function', () => {
    const extra = { ...complete, TITLE: [['x']] } as const
    expectTypeOf<Check<Module, typeof extra>>().toEqualTypeOf<{ notAFunction: 'TITLE' }>()
  })

  test('lets a free string or number take any fixture', () => {
    const anyFixture = { ...complete, free: [['whatever', 99]] } as const
    expectTypeOf<Check<Module, typeof anyFixture>>().toEqualTypeOf<unknown>()
  })
})

describe('baselineArgs', () => {
  test('returns the table as written', () => {
    const table = baselineArgs<Module>()(complete)
    expect(table).toBe(complete)
  })
})

describe('counted', () => {
  test('expands to the calls for 0, 1 and 2', () => {
    expect(counted((n) => [n, 'x'])).toEqual([
      [0, 'x'],
      [1, 'x'],
      [2, 'x'],
    ])
  })

  test('marks every row it builds, and only those', () => {
    const rows = counted((n) => [n])
    expect(rows.map(isCounted)).toEqual([true, true, true])
    expect(isCounted([1])).toBe(false)
  })

  test('keeps the literal types of the rows it builds', () => {
    const rows = counted((n) => [n, 'x'])
    expectTypeOf(rows).toEqualTypeOf<readonly [readonly [number, 'x'], readonly [number, 'x'], readonly [number, 'x']]>()
  })
})
