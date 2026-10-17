import { describe, expect, test } from 'vitest'
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
    expect(unregistered(['/', '/ventas', '/nueva-pantalla', '/ventas/:id/recibo'], registryRoutes, excused)).toEqual([
      '/nueva-pantalla',
      '/ventas/:id/recibo',
    ])
  })

  test('a registry route, a placeholder match, and the two excuse lists are accepted', () => {
    expect(
      unregistered(['/ventas/:id', '*', '/old', '/mi-stock', '/clientes/:id/editar'], registryRoutes, excused),
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
    expect(patternsMatch('/ventas/:id', '/ventas/{owing_sale}')).toBe(true)
    expect(patternsMatch('/ventas/:id', '/ventas')).toBe(false)
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
