/**
 * The pure half of the route-coverage guard: flatten a route tree into full patterns,
 * match patterns against the registry's routes, and name what is excused. React-free on
 * purpose (it lives in `mobile-standard/`, which holds no React import); the real router
 * is read by `src/routeCoverage.real.test.ts`, which sits outside this folder because
 * importing `router.tsx` pulls in React.
 */

import { HOME, ONBOARDING, ONBOARDING_DONE, WITHDRAWAL_EDIT } from '../routes.ts'

/** The shape of a route object this guard reads (react-router's `RouteObject` fits it). */
export interface RouteNode {
  path?: string | undefined
  index?: boolean | undefined
  children?: readonly RouteNode[] | undefined
}

/** Router patterns that are not a screen and are not redirects: the catch-all. */
export const NOT_SCREENS: Readonly<Record<string, string>> = {
  '*': 'catch-all: redirects to the home screen',
}

/**
 * The redirect-only routes (none today: no front code redirects) as excuses, each with its reason. The table
 * is passed in, not imported: it lives in a module that pulls in React.
 */
export function redirectExcuses(table: readonly { from: string }[]): Record<string, string> {
  return Object.fromEntries(
    table.map(({ from }) => [from, 'redirect-only: replaces itself with another route (a table of redirects)']),
  )
}

/**
 * Real screen routes the registry does not name yet. They have no design file, so adding
 * them to `scripts/design/screens.json` needs a plan or product decision; until then they
 * are known gaps, not exemptions. The list can only shrink: an entry the registry now
 * covers must be removed (the real test fails on it).
 */
export const UNREGISTERED_ROUTES: Readonly<Record<string, string>> = {
  [ONBOARDING]: 'the onboarding entry: it only redirects to the current step, no registry entry',
  [ONBOARDING_DONE]: 'the onboarding end: reached once per business, no registry entry',
  [WITHDRAWAL_EDIT]: 'edit form of a withdrawal: no design file or registry entry',
}

/** Every full pattern the router can render a screen for: leaves and index routes. */
export function flattenRoutes(routes: readonly RouteNode[], parent = ''): string[] {
  return routes.flatMap((route) => {
    if (route.path === '*') return ['*']
    const own = route.path ?? ''
    const full = own === '' ? parent : own.startsWith(HOME) ? own : `${parent.replace(/\/$/, '')}/${own}`
    if (route.children !== undefined && route.children.length > 0) return flattenRoutes(route.children, full)
    return [full === '' ? HOME : full]
  })
}

const isParam = (segment: string): boolean => segment.startsWith(':') || /^\{.+\}$/.test(segment)

function segments(pattern: string): string[] {
  return pattern.split(HOME).filter((segment) => segment !== '')
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

/** The router patterns no registry route matches and no excuse list names. */
export function unregistered(
  patterns: readonly string[],
  registryRoutes: readonly string[],
  excused: readonly Readonly<Record<string, string>>[],
): string[] {
  return patterns.filter(
    (pattern) =>
      !excused.some((list) => Object.hasOwn(list, pattern)) &&
      !registryRoutes.some((route) => patternsMatch(pattern, route)),
  )
}
