import { describe, expect, test } from 'vitest'
import { judgeLoading, type LoadingFacts } from './loading.ts'

const cell = { screen: 'Sales', size: '375x812', theme: 'claro' } as const
const GOOD: LoadingFacts = { blank: false, busy: true, falseEmpty: [], data: [] }
const raw = (label: string) => ({ testid: '', role: 'p', label, identity: '' })

describe('judgeLoading', () => {
  test('a skeleton that is busy, empty of words and of data is not reported', () => {
    expect(judgeLoading(GOOD, cell)).toEqual([])
  })

  test('a blank content area and a missing aria-busy are page rules', () => {
    expect(judgeLoading({ ...GOOD, blank: true, busy: false }, cell)).toEqual([
      { ...cell, rule: 'blank-while-loading', target: '' },
      { ...cell, rule: 'aria-busy', target: '' },
    ])
  })

  test('a false empty state and a figure while loading are named by their element', () => {
    expect(
      judgeLoading({ ...GOOD, falseEmpty: [raw('Nadie te debe.')], data: [raw('$ 0')] }, cell),
    ).toEqual([
      { ...cell, rule: 'false-empty', target: 'p:Nadie te debe.' },
      { ...cell, rule: 'data-while-loading', target: 'p:$ #' },
    ])
  })
})
