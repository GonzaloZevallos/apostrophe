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
const NO_TAB: string[] = []

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

const gated = leaves(routes, '', false, [])

test('the gated branch has leaves to check', () => {
  expect(gated.length).toBeGreaterThan(20)
  expect(gated.map((leaf) => leaf.path)).toContain(paths.settingsUsers())
})

test('every gated leaf declares a route kind', () => {
  for (const leaf of gated) expect(isRouteHandle(leaf.handle), leaf.path).toBe(true)
})

test('every gated leaf marks a tab, or is a listed, deliberate none', () => {
  for (const leaf of gated) {
    const tab = activeTab(leaf.path.replace(/:\w+/g, '7'))
    if (NO_TAB.includes(leaf.path)) expect(tab, leaf.path).toBeNull()
    else expect(tab, leaf.path).not.toBeNull()
  }
})
