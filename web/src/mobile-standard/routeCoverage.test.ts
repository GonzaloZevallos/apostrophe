import type { RouteObject } from 'react-router'
import { describe, expect, test } from 'vitest'
import { router } from '../router'
import { redirects } from '../redirects'
import { REGISTRY } from './registry.ts'

/**
 * Router patterns that are not a screen of the registry, each with its reason. A pattern
 * listed here that the router no longer has fails too, so the list cannot go stale.
 */
export const NOT_SCREENS: Record<string, string> = {
  '*': 'catch-all: redirects to the home screen',
  ...Object.fromEntries(
    redirects.map(({ from, to }) => [from, `redirect-only: replaces itself with ${to}`]),
  ),
  '/clientes/:id/editar':
    'edit form of a customer: no design file or registry entry yet; walked as a state (STATE_NAMES) by the states subtasks',
  '/mi-stock':
    'the stock list: no registry entry (its route is walked as a state, STATE_NAMES) until the registry names it',
  '/mi-stock/entradas/:id':
    'edit form of a stock entry: no registry entry; walked as a state (STATE_NAMES) by the states subtasks',
}

/** Every full pattern the router can render a screen for: leaves and index routes. */
export function flattenRoutes(routes: readonly RouteObject[], parent = ''): string[] {
  return routes.flatMap((route) => {
    if (route.path === '*') return ['*']
    const own = route.path === undefined ? '' : route.path
    const full = own === '' ? parent : own.startsWith('/') ? own : `${parent.replace(/\/$/, '')}/${own}`
    if (route.children !== undefined && route.children.length > 0) return flattenRoutes(route.children, full)
    return [full === '' ? '/' : full]
  })
}

const isParam = (segment: string): boolean => segment.startsWith(':') || /^\{.+\}$/.test(segment)

function segments(pattern: string): string[] {
  return pattern.split('/').filter((segment) => segment !== '')
}

/** Same number of segments, each equal or a parameter (`:x` or `{x}`) on either side. */
export function patternsMatch(a: string, b: string): boolean {
  const left = segments(a)
  const right = segments(b)
  return (
    left.length === right.length &&
    left.every((segment, i) => {
      const other = right[i] ?? ''
      return segment === other || isParam(segment) || isParam(other)
    })
  )
}

/** The router patterns no registry route matches and no `notScreens` entry excuses. */
export function unregistered(
  patterns: readonly string[],
  registryRoutes: readonly string[],
  notScreens: Record<string, string>,
): string[] {
  return patterns.filter(
    (pattern) =>
      !Object.hasOwn(notScreens, pattern) && !registryRoutes.some((route) => patternsMatch(pattern, route)),
  )
}

const registryRoutes = REGISTRY.flatMap((screen) => (screen.route === null ? [] : [screen.route]))
const patterns = flattenRoutes(router.routes)

describe('the front’s routes against scripts/design/screens.json', () => {
  test('every route the router renders is a registry route or listed with a reason', () => {
    expect(patterns.length).toBeGreaterThan(20)
    expect(unregistered(patterns, registryRoutes, NOT_SCREENS)).toEqual([])
  })

  test('a route missing from the registry fails (fixture)', () => {
    expect(unregistered([...patterns, '/nueva-pantalla', '/ventas/:id/recibo'], registryRoutes, NOT_SCREENS)).toEqual([
      '/nueva-pantalla',
      '/ventas/:id/recibo',
    ])
  })

  test('NOT_SCREENS names only patterns the router has, each with a reason', () => {
    for (const [pattern, reason] of Object.entries(NOT_SCREENS)) {
      expect(patterns).toContain(pattern)
      expect(reason).not.toBe('')
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
      ]),
    ).toEqual(['/a', '/a/:id/x', '/b'])
  })
})
