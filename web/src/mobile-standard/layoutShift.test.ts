import { describe, expect, test } from 'vitest'
import { CHROME_SHIFT_PX, CONTENT_SHIFT_PX, judgeShifts, shiftOf, type ShiftSample } from './layoutShift.ts'

const rect = (top: number, left: number) => ({ top, left, width: 100, height: 40 })

describe('shiftOf', () => {
  test('is the larger of the vertical and horizontal move, in either direction', () => {
    expect(shiftOf(rect(10, 10), rect(10, 10))).toBe(0)
    expect(shiftOf(rect(10, 10), rect(58, 10))).toBe(48)
    expect(shiftOf(rect(58, 10), rect(10, 10))).toBe(48)
    expect(shiftOf(rect(10, 10), rect(20, 35))).toBe(25)
  })

  test('a resize that keeps the top-left corner is no shift', () => {
    expect(shiftOf(rect(10, 10), { top: 10, left: 10, width: 300, height: 300 })).toBe(0)
  })
})

describe('tolerances', () => {
  test('chrome never moves, and content has the one named tolerance', () => {
    expect(CHROME_SHIFT_PX).toBe(0)
    expect(CONTENT_SHIFT_PX).toBe(48)
  })
})

describe('judgeShifts', () => {
  const cell = { screen: 'Ventas', size: '375x812', theme: 'claro' } as const
  const raw = (label: string) => ({ testid: '', role: 'div', label, identity: '' })
  const move = (node: number, chrome: boolean, by: number, label = 'x'): ShiftSample => ({
    node,
    chrome,
    previous: rect(100, 10),
    current: rect(100 + by, 10),
    raw: raw(label),
  })
  const rules = (samples: ShiftSample[]) => judgeShifts(samples, cell).map((v) => v.rule)

  test('chrome moving at all is reported, content only beyond the tolerance', () => {
    expect(rules([move(1, true, 1)])).toEqual(['chrome-shift'])
    expect(rules([move(1, false, CONTENT_SHIFT_PX)])).toEqual([])
    expect(rules([move(1, false, CONTENT_SHIFT_PX + 1)])).toEqual(['content-shift'])
  })

  test('every content node that moved is one finding, named by the content area', () => {
    const found = judgeShifts([move(1, false, 60, 'a'), move(2, false, 90, 'b')], cell)
    expect(found).toEqual([{ ...cell, rule: 'content-shift', target: 'main:content' }])
  })

  test('chrome that did not move is not reported', () => {
    expect(rules([move(1, true, 0)])).toEqual([])
  })

  test('an inserted or a removed node is not a shift', () => {
    const empty = { top: 0, left: 0, width: 0, height: 0 }
    expect(rules([{ ...move(1, false, 500), previous: empty }])).toEqual([])
    expect(rules([{ ...move(1, true, 500), current: empty }])).toEqual([])
  })

  test('a node that moved twice counts once, by its largest move', () => {
    expect(rules([move(1, false, 30), move(1, false, 60)])).toEqual(['content-shift'])
    expect(rules([move(1, false, 30), move(1, false, 40)])).toEqual([])
  })
})
