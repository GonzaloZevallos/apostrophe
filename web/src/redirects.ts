/**
 * Every old path that now lives somewhere else (plan, "Redirects"): one typed table, one
 * line each, landing in the same diff as its target route, its unit test and every e2e
 * `goto` of the old path. A client replace, not a server 301: `SpaStatic` hands every
 * non-API path to the front router. The `*` catch-all stays in `router.tsx` and goes to
 * `/`; it is not an entry here.
 */

import { createElement } from 'react'
import { Navigate, type RouteObject } from 'react-router'

export interface Redirect {
  from: string
  to: string
}

export const redirects: readonly Redirect[] = []

/** The table as routes the router can mount beside its own, each a `<Navigate replace>`. */
export function redirectRoutes(table: readonly Redirect[] = redirects): RouteObject[] {
  return table.map(({ from, to }) => ({
    path: from,
    element: createElement(Navigate, { to, replace: true }),
  }))
}
