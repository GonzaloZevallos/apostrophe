/**
 * The async-timeout scanner on its proof inputs: it must reject every shape of an async
 * timeout below the ceiling (or one it cannot read), including a call split across lines,
 * and accept the timeouts that are not async-util ones. `asyncTimeouts.real.test.ts` runs
 * it over the real tree.
 */

import { describe, expect, it } from 'vitest'
import { findShortAsyncTimeouts } from './asyncTimeouts'

function scan(content: string) {
  return findShortAsyncTimeouts([{ path: '/src/x.test.tsx', content }])
}

describe('findShortAsyncTimeouts', () => {
  it('rejects a call split across lines, with the line of the key', () => {
    const content = ['await screen.findByText(', '  "x", {}, { timeout: 4000 }', ')'].join('\n')
    expect(scan(content)).toEqual([{ path: '/src/x.test.tsx', line: 2 }])
  })

  it('rejects a timeout below the ceiling, however it is written', () => {
    expect(scan('f({ timeout: 1_000 })')).toHaveLength(1)
    expect(scan('waitFor(fn, { timeout: 500 })')).toHaveLength(1)
    expect(scan('f({ "timeout": 500 })')).toHaveLength(1)
    expect(scan("f({ 'timeout' : 9999 })")).toHaveLength(1)
    expect(scan('configure({ asyncUtilTimeout: 500 })')).toHaveLength(1)
  })

  it('rejects a timeout it cannot read as a number', () => {
    expect(scan('f({ timeout: SHORT })')).toHaveLength(1)
  })

  it('rejects the shorthand, which hides its value', () => {
    expect(scan('f({ timeout })')).toHaveLength(1)
    expect(scan('f({ retries: 1, timeout })')).toHaveLength(1)
  })

  it('accepts a timeout at or above the ceiling', () => {
    expect(scan('f({ timeout: 15_000 })')).toEqual([])
    expect(scan('f({ timeout: 10000 })')).toEqual([])
  })

  it('accepts what is not an async timeout', () => {
    expect(scan("run('--step-timeout', '1')")).toEqual([])
    expect(scan("shotStepReason('timeout', 'design')")).toEqual([])
    expect(scan('setTimeout(fn, 10)')).toEqual([])
    expect(scan('window.clearTimeout(id)')).toEqual([])
  })
})
