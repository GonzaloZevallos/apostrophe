import { describe, expect, test } from 'vitest'
import { HOME, SALE, SALES } from '../routes.ts'
import { ROUTE_REGISTRY } from './registry.ts'
import { flattenRoutes, NOT_SCREENS, patternsMatch, redirectExcuses, unregistered } from './routeCoverage.ts'

const excused = [NOT_SCREENS, redirectExcuses([{ from: '/old' }])]
const registryRoutes = ROUTE_REGISTRY.map((entry) => entry.path)

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
      unregistered(['/withdrawals/new', '/varieties/entries/new'], ['/withdrawals/{id}', '/varieties/entries/{id}'], excused),
    ).toEqual(['/withdrawals/new', '/varieties/entries/new'])
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
    expect(patternsMatch('/varieties/entries/new', '/varieties/entries/{id}')).toBe(false)
    expect(patternsMatch('/varieties/entries/{id}', '/varieties/entries/new')).toBe(false)
    expect(patternsMatch('/withdrawals/new', '/withdrawals/{id}')).toBe(false)
    expect(patternsMatch('/withdrawals/:id', '/withdrawals/new')).toBe(false)
    expect(patternsMatch('/sales/:id', '/sales/{owing_sale}')).toBe(true)
    expect(patternsMatch('/varieties/entries/new', '/varieties/entries/new')).toBe(true)
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
