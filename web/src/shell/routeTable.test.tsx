/**
 * The route table against the shell's two decisions: every gated leaf declares a
 * `handle.kind` and maps to a tab, or is on the list of leaves that deliberately
 * mark none (no such leaf today). A screen added to the gated branch without a tab
 * fails here, instead of showing a bar with nothing lit.
 */

import { isValidElement } from 'react'
import type { RouteObject } from 'react-router'
import { expect, test } from 'vitest'
import { routes } from '../router'
import { paths } from '../routes/paths'
import { activeTab } from './activeTab'
import { isRouteHandle } from './routeHandle'
import Shell from './Shell'

/** Gated leaves whose pathname marks no tab on purpose. */
const NO_TAB: readonly string[] = []

interface Leaf {
  path: string
  handle: unknown
}

function leaves(list: RouteObject[], parent: string, underShell: boolean, out: Leaf[]): Leaf[] {
  for (const route of list) {
    const path = route.index === true ? parent : (route.path ?? parent)
    const shell = underShell || (isValidElement(route.element) && route.element.type === Shell)
    if (route.children !== undefined) {
      leaves(route.children, path, shell, out)
    } else if (shell) {
      out.push({ path: path === '' ? paths.home() : path, handle: route.handle })
    }
  }
  return out
}

/** The gated leaves of a table whose path marks no tab and are not on `deliberate`. */
function untabbedLeaves(table: RouteObject[], deliberate: readonly string[]): string[] {
  return leaves(table, '', false, [])
    .map((leaf) => leaf.path)
    .filter((path) => activeTab(path.replace(/:\w+/g, '7')) === null && !deliberate.includes(path))
}

const gated = leaves(routes, '', false, [])

test('the gated branch has leaves to check', () => {
  expect(gated.length).toBeGreaterThan(20)
  expect(gated.map((leaf) => leaf.path)).toContain(paths.settingsUsers())
})

test('every gated leaf declares a route kind', () => {
  for (const leaf of gated) expect(isRouteHandle(leaf.handle), leaf.path).toBe(true)
})

test('every gated leaf marks a tab, or is a listed, deliberate none', () => {
  expect(untabbedLeaves(routes, NO_TAB)).toEqual([])
})

const ROOT = { kind: 'root' } as const

function underShell(children: RouteObject[]): RouteObject[] {
  return [{ element: <Shell />, children }]
}

test('a gated leaf whose path marks no tab is reported, a listed one and a public one are not', () => {
  const table: RouteObject[] = [
    { path: '/public-only', element: <div /> },
    ...underShell([
      { index: true, element: <div />, handle: ROOT },
      { path: paths.sales(), element: <div />, handle: ROOT },
      { path: '/orphan/:id', element: <div />, handle: ROOT },
      { path: '/listed', element: <div />, handle: ROOT },
    ]),
  ]

  expect(untabbedLeaves(table, ['/listed'])).toEqual(['/orphan/:id'])
  expect(untabbedLeaves(table, [])).toEqual(['/orphan/:id', '/listed'])
})

test('a nested gated leaf with no tab is reached and reported', () => {
  const table = underShell([
    { path: paths.customers(), element: <div />, children: [{ path: '/nowhere', element: <div />, handle: ROOT }] },
  ])

  expect(untabbedLeaves(table, [])).toEqual(['/nowhere'])
})
