import { describe, expect, test } from 'vitest'
import { CHROME_SHIFT_PX, CONTENT_SHIFT_PX, shiftOf } from './layoutShift.ts'

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
