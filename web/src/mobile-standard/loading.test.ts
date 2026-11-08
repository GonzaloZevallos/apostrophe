import { describe, expect, test } from 'vitest'
import { judgeLoading, judgeWaiting, type LoadingFacts } from './loading.ts'

const cell = { screen: 'Sales', size: '375x812', theme: 'claro' } as const
const GOOD: LoadingFacts = { lang: 'en', blank: false, texts: [], data: [] }
const raw = (label: string) => ({ testid: '', role: 'p', label, identity: '' })
const shown = (text: string) => ({ text, raw: raw(text) })
const FORBIDDEN = ['Nobody owes you', 'Nadie te debe.']
const violationsOf = (facts: LoadingFacts, forbidden = FORBIDDEN, run = 'en') =>
  judgeLoading(facts, cell, forbidden, run).violations

describe('judgeLoading', () => {
  test('a skeleton that is busy, empty of words and of data is not reported', () => {
    expect(judgeLoading(GOOD, cell, FORBIDDEN, 'en')).toEqual({ language: null, violations: [] })
  })

  test('a blank content area is a page rule, and the held verdict no longer judges aria-busy', () => {
    expect(violationsOf({ ...GOOD, blank: true })).toEqual([{ ...cell, rule: 'blank-while-loading', target: '' }])
    expect(violationsOf(GOOD)).toEqual([])
  })

  test('a false empty state and a figure while loading are named by their element', () => {
    expect(
      violationsOf({ ...GOOD, texts: [shown('Nadie te debe. Hoy'), shown('Cargando')], data: [raw('$ 0')] }),
    ).toEqual([
      { ...cell, rule: 'false-empty', target: 'p:Nadie te debe. Hoy' },
      { ...cell, rule: 'data-while-loading', target: 'p:$ #' },
    ])
  })

  test('a text is forbidden only if the list the run resolved holds it', () => {
    const facts = { ...GOOD, texts: [shown('Nobody owes you')] }
    expect(violationsOf(facts, ['Nadie te debe.'])).toEqual([])
    expect(violationsOf(facts, ['Nobody owes you'])).toEqual([
      { ...cell, rule: 'false-empty', target: 'p:Nobody owes you' },
    ])
  })

  test('a page whose lang is not the run’s fails with the language reason, never as a false-empty', () => {
    const verdict = judgeLoading({ ...GOOD, lang: 'en', texts: [shown('Nobody owes you')] }, cell, FORBIDDEN, 'en-XA')
    expect(verdict.language).toBe('page lang en, run locale en-XA')
    expect(verdict.violations.filter((v) => v.rule === 'false-empty')).toEqual([])
    expect(judgeLoading({ ...GOOD, lang: 'en-XA' }, cell, FORBIDDEN, 'en-XA').language).toBeNull()
  })
})

describe('judgeWaiting', () => {
  const busyRule = [{ ...cell, rule: 'aria-busy', target: '' }]

  test('an area that was waiting and says it is busy, or was not waiting and is not busy, is not reported', () => {
    expect(judgeWaiting({ waiting: true, busy: true }, cell)).toEqual([])
    expect(judgeWaiting({ waiting: false, busy: false }, cell)).toEqual([])
  })

  test('an area that was waiting and does not say it is busy is a page rule', () => {
    expect(judgeWaiting({ waiting: true, busy: false }, cell)).toEqual(busyRule)
  })

  test('an area that was not waiting and says it is busy is a page rule', () => {
    expect(judgeWaiting({ waiting: false, busy: true }, cell)).toEqual(busyRule)
  })
})
