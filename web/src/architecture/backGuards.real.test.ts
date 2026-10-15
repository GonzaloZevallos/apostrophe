/**
 * The back guard over the real tree (GH-166): only the shell's `BackArrow` draws a back. The
 * exemptions are named in `backExempt.ts`; the temporary ones belong to a2 and must still be
 * needed (a stale entry fails).
 */

import { expect, test } from 'vitest'
import { findOwnBacks } from './backGuards'
import { BACK_VARIANT_EXEMPT, CHEVRON_EXEMPT, CHEVRON_TEMPORARY } from './backExempt'

const modules = import.meta.glob(['/src/**/*.{ts,tsx}'], { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>
const files = Object.entries(modules).map(([path, content]) => ({ path, content }))
const temporary = CHEVRON_TEMPORARY.map((path) => ({ path, reason: 'removed by a2' }))

test('the tree is the one the guard expects', () => {
  expect(files.some(({ path }) => path === '/src/shell/BackArrow.tsx')).toBe(true)
  expect(files.length).toBeGreaterThan(50)
})

test('no screen draws its own back, but the named exemptions', () => {
  expect(findOwnBacks(files, [...CHEVRON_EXEMPT, ...temporary], BACK_VARIANT_EXEMPT)).toEqual([])
})

test('every exemption is still needed', () => {
  for (const entry of [...CHEVRON_EXEMPT, ...temporary]) {
    const own = findOwnBacks(files.filter(({ path }) => path === entry.path), [], [])
    expect(own.length, `${entry.path}: ${entry.reason}`).toBeGreaterThan(0)
  }
})
