/**
 * Two invariants about the route table, as functions over a route array so a test
 * feeds them a table that must fail:
 *
 * - every gated leaf declares exactly one `handle.kind`, and a detail has a parent
 *   (`gatedLeafViolations`);
 * - every first segment of the table, and of every old path, is in `contract.json`'s
 *   `routeSegments`, so the server answers `index.html` to a reload there
 *   (`uncoveredSegments`).
 */

import type { ReactElement } from 'react'
import type { RouteObject } from 'react-router'

export function isGate(route: RouteObject, gate: unknown): boolean {
  const element = route.element
  return (
    typeof element === 'object' && element !== null && (element as ReactElement).type === gate
  )
}

function hasParent(handle: Record<string, unknown>): boolean {
  const parent = handle['parent']
  if (typeof parent !== 'object' || parent === null) return false
  const link = (value: unknown): boolean =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)['label'] === 'string' &&
    typeof (value as Record<string, unknown>)['to'] === 'string'
  if ('phone' in parent && 'computer' in parent) return link(parent.phone) && link(parent.computer)
  return link(parent)
}

function describe(route: RouteObject): string {
  return route.index === true ? 'index route' : `route ${route.path ?? '(no path)'}`
}

/** Leaves under the route whose element is `gate` (`GatedLayout`) that break the rule. */
export function gatedLeafViolations(routes: RouteObject[], gate: unknown): string[] {
  const found: string[] = []
  const walk = (list: RouteObject[], gated: boolean): void => {
    for (const route of list) {
      const inside = gated || isGate(route, gate)
      if (route.children !== undefined) {
        walk(route.children, inside)
        continue
      }
      if (!inside) continue
      const handle: unknown = route.handle
      if (typeof handle !== 'object' || handle === null) {
        found.push(`${describe(route)} declares no handle`)
        continue
      }
      const record = handle as Record<string, unknown>
      const kind = record['kind']
      if (kind !== 'root' && kind !== 'detail' && kind !== 'form') {
        found.push(`${describe(route)} declares no valid handle.kind`)
      } else if (kind === 'detail' && !hasParent(record)) {
        found.push(`${describe(route)} is a detail without a parent`)
      } else if (kind !== 'detail' && 'parent' in record) {
        found.push(`${describe(route)} is a ${kind} but names a parent`)
      }
    }
  }
  walk(routes, false)
  return found
}

/** Every full path of the table (`*` aside), a child's relative path joined to its parent's. */
export function routePaths(routes: RouteObject[], base = ''): string[] {
  const all: string[] = []
  for (const route of routes) {
    const own = route.path
    const full =
      own === undefined ? base : own.startsWith('/') ? own : `${base.replace(/\/$/, '')}/${own}`
    if (own !== undefined && own !== '*') all.push(full)
    if (route.children !== undefined) all.push(...routePaths(route.children, full))
  }
  return all
}

export function firstSegment(path: string): string {
  return path.split('/')[1] ?? ''
}

/** First segments among `paths` that `routeSegments` does not list. */
export function uncoveredSegments(paths: string[], routeSegments: readonly string[]): string[] {
  const missing = new Set<string>()
  for (const path of paths) {
    const segment = firstSegment(path)
    if (segment !== '' && !routeSegments.includes(segment)) missing.add(segment)
  }
  return [...missing]
}
