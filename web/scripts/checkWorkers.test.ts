import { describe, expect, it } from 'vitest'
import { checkWorkers } from './checkWorkers.ts'

describe('checkWorkers', () => {
  it.each([
    [undefined, undefined],
    ['', undefined],
    ['abc', undefined],
    ['0', undefined],
    ['-1', undefined],
    ['2.5', undefined],
    [' 2', undefined],
    ['2', 2],
    ['16', 16],
  ])('CHECK_WORKERS=%j gives %j', (value, expected) => {
    expect(checkWorkers({ CHECK_WORKERS: value })).toBe(expected)
  })

  it('is undefined when the variable is absent', () => {
    expect(checkWorkers({})).toBeUndefined()
  })
})
