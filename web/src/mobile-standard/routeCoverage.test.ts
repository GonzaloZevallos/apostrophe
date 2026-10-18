import { describe, expect, test } from 'vitest'
import { HOME, SALE, SALES } from '../routes.ts'
import { REGISTRY } from './registry.ts'
import {
  flattenRoutes,
  NOT_SCREENS,
  patternsMatch,
  redirectExcuses,
  unregistered,
  UNREGISTERED_ROUTES,
} from './routeCoverage.ts'

const excused = [NOT_SCREENS, redirectExcuses([{ from: '/old' }]), UNREGISTERED_ROUTES]
const registryRoutes = REGISTRY.flatMap((screen) => (screen.route === null ? [] : [screen.route]))

describe('route coverage, pure half', () => {
  test('a route missing from the registry is reported (fixture)', () => {
    expect(unregistered([HOME, SALES, '/new-screen', `${SALE}/receipt`], registryRoutes, excused)).toEqual([
      '/new-screen',
      `${SALE}/receipt`,
    ])
  })

  test('a registry route, a placeholder match, and the two excuse lists are accepted', () => {
    expect(
      unregistered([SALE, '*', '/old', ...Object.keys(UNREGISTERED_ROUTES)], registryRoutes, excused),
    ).toEqual([])
  })

  test('NOT_SCREENS holds only the catch-all; every excuse has a reason', () => {
    expect(Object.keys(NOT_SCREENS)).toEqual(['*'])
    expect(redirectExcuses([{ from: '/old' }])).toEqual({ '/old': expect.stringContaining('redirect-only') })
    for (const reason of [...Object.values(NOT_SCREENS), ...Object.values(UNREGISTERED_ROUTES)]) {
      expect(reason).not.toBe('')
    }
  })

  test('an unregistered-routes entry is a pattern the registry really lacks', () => {
    for (const pattern of Object.keys(UNREGISTERED_ROUTES)) {
      expect(registryRoutes.some((route) => patternsMatch(pattern, route))).toBe(false)
    }
  })

  test('a placeholder and a router parameter each count as one segment', () => {
    expect(patternsMatch(SALE, SALE.replace(':id', '{owing_sale}'))).toBe(true)
    expect(patternsMatch(SALE, SALES)).toBe(false)
    expect(patternsMatch('/a/b', '/a/c')).toBe(false)
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
