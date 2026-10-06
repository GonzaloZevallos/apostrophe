/**
 * The route-table walker (plan, seam "route-table walker test"): a table that breaks the
 * rules is reported, and the real table is clean. Also the first-segment rule against
 * `contract.json`'s `routeSegments`: the server only answers `index.html` to a reload
 * under a segment listed there.
 */

import { expect, test } from 'vitest'
import type { RouteObject } from 'react-router'
import contract from '../api/contract.json'
import { routes } from '../router'
import { paths } from '../routes/paths'
import { LEGACY_REDIRECTS } from '../routes/legacy'
import GatedLayout from '../shell/GatedLayout'
import { firstSegment, gatedLeafViolations, routePaths, uncoveredSegments } from './routeTable'

const PARENT = { label: 'Ventas', to: paths.sales() }

function gated(children: RouteObject[]): RouteObject[] {
  return [{ path: paths.login(), element: <div /> }, { element: <GatedLayout />, children }]
}

test('the real table: every gated leaf has exactly one valid kind, every detail a parent', () => {
  expect(gatedLeafViolations(routes, GatedLayout)).toEqual([])
})

test('a gated leaf with no handle, a bad kind or a detail without a parent is reported', () => {
  const broken = gated([
    { path: '/a', element: <div /> },
    { path: '/b', element: <div />, handle: { kind: 'tab' } },
    { path: '/c', element: <div />, handle: { kind: 'detail' } },
    { path: '/d', element: <div />, handle: { kind: 'detail', parent: { label: 'x' } } },
    { path: '/e', element: <div />, handle: { kind: 'form', parent: PARENT } },
    { index: true, element: <div /> },
  ])

  expect(gatedLeafViolations(broken, GatedLayout)).toEqual([
    'route /a declares no handle',
    'route /b declares no valid handle.kind',
    'route /c is a detail without a parent',
    'route /d is a detail without a parent',
    'route /e is a form but names a parent',
    'index route declares no handle',
  ])
})

test('a valid table, a layout without a handle and a public leaf pass', () => {
  const fine = gated([
    { path: '/a', element: <div />, handle: { kind: 'root' } },
    { path: '/b', element: <div />, handle: { kind: 'detail', parent: PARENT } },
    {
      path: '/c',
      element: <div />,
      handle: { kind: 'detail', parent: { phone: PARENT, computer: PARENT } },
    },
    { path: '/d', element: <div />, children: [{ index: true, element: <div />, handle: { kind: 'form' } }] },
  ])

  expect(gatedLeafViolations(fine, GatedLayout)).toEqual([])
})

test('every first segment of the table and of every old path is in routeSegments', () => {
  const tablePaths = routePaths(routes)
  expect(tablePaths.length).toBeGreaterThan(20)
  expect(uncoveredSegments(tablePaths, contract.routeSegments)).toEqual([])
  expect(uncoveredSegments(Object.keys(LEGACY_REDIRECTS), contract.routeSegments)).toEqual([])
})

test('a segment missing from routeSegments is reported, relative children joined to their parent', () => {
  const table: RouteObject[] = [
    { path: paths.sales(), children: [{ path: 'new', element: <div /> }] },
    { path: 'pedidos', children: [{ path: ':id', element: <div /> }] },
    { path: '*', element: <div /> },
  ]

  expect(routePaths(table)).toEqual([paths.sales(), paths.newSale(), '/pedidos', '/pedidos/:id'])
  expect(uncoveredSegments([paths.newSale(), '/pedidos/7', paths.home()], contract.routeSegments)).toEqual(['pedidos'])
  expect(firstSegment(paths.home())).toBe('')
})
