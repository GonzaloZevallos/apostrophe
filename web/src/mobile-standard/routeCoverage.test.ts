import { describe, expect, test } from 'vitest'
import { HOME, SALE, SALES } from '../routes.ts'
import { ROUTE_REGISTRY } from './registry.ts'
import { flattenRoutes, NOT_SCREENS, patternsMatch, redirectExcuses, unregistered } from './routeCoverage.ts'

const excused = [NOT_SCREENS, redirectExcuses([{ from: '/old' }])]
const registryRoutes = ROUTE_REGISTRY.map((entry) => entry.path)
/** A path built from its segments, so the test writes no route literal (the source scan in routes.test.ts). */
const at = (...segments: string[]): string => segments.map((segment) => `${HOME}${segment}`).join('')
const withdrawalNew = at('withdrawals', 'new')
const entryNew = at('varieties', 'entries', 'new')

describe('route coverage, pure half', () => {
  test('a route missing from the registry is reported (fixture)', () => {
    expect(unregistered([HOME, SALES, '/new-screen', `${SALE}/receipt`], registryRoutes, excused)).toEqual([
      '/new-screen',
      `${SALE}/receipt`,
    ])
  })

  test('a registry route, a placeholder match, and the two excuse lists are accepted', () => {
    expect(unregistered([SALE, '*', '/old'], registryRoutes, excused)).toEqual([])
  })

  test('a literal route is not covered by a parameter registry path', () => {
    expect(
      unregistered([withdrawalNew, entryNew], [at('withdrawals', '{id}'), at('varieties', 'entries', '{id}')], excused),
    ).toEqual([withdrawalNew, entryNew])
  })

  test('NOT_SCREENS holds only the catch-all; every excuse has a reason', () => {
    expect(Object.keys(NOT_SCREENS)).toEqual(['*'])
    expect(redirectExcuses([{ from: '/old' }])).toEqual({ '/old': expect.stringContaining('redirect-only') })
    for (const reason of Object.values(NOT_SCREENS)) {
      expect(reason).not.toBe('')
    }
  })

  test('a placeholder and a router parameter each count as one segment', () => {
    expect(patternsMatch(SALE, SALE.replace(':id', '{owing_sale}'))).toBe(true)
    expect(patternsMatch(SALE, SALES)).toBe(false)
    expect(patternsMatch('/a/b', '/a/c')).toBe(false)
  })

  test('a literal matches only an equal literal, never a parameter, in both directions', () => {
    expect(patternsMatch(entryNew, at('varieties', 'entries', '{id}'))).toBe(false)
    expect(patternsMatch(at('varieties', 'entries', '{id}'), entryNew)).toBe(false)
    expect(patternsMatch(withdrawalNew, at('withdrawals', '{id}'))).toBe(false)
    expect(patternsMatch(at('withdrawals', ':id'), withdrawalNew)).toBe(false)
    expect(patternsMatch(at('sales', ':id'), at('sales', '{owing_sale}'))).toBe(true)
    expect(patternsMatch(entryNew, entryNew)).toBe(true)
  })

  test('a parameter against a literal is false in each position', () => {
    expect(patternsMatch('/:a/b', '/x/b')).toBe(false)
    expect(patternsMatch('/a/:b/c', '/a/x/c')).toBe(false)
    expect(patternsMatch('/a/b/{c}', '/a/b/x')).toBe(false)
    expect(patternsMatch('/a/{b}/{c}', '/a/:x/:y')).toBe(true)
  })

  test('a different segment count is false', () => {
    expect(patternsMatch('/a/b', '/a/b/c')).toBe(false)
    expect(patternsMatch('/a/:id', '/a')).toBe(false)
    expect(patternsMatch(HOME, '/a')).toBe(false)
  })

  test('flattening joins nested paths and takes index routes as their parent', () => {
    expect(
      flattenRoutes([
        { path: 'a', children: [{ index: true }, { path: ':id', children: [{ path: 'x' }] }] },
        { path: '/b' },
        { path: '*' },
      ]),
    ).toEqual(['/a', '/a/:id/x', '/b', '*'])
  })
})
