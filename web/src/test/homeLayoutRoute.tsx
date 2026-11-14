/**
 * Home and Analysis under their layout route, as `router.tsx` mounts them: a test that mounts
 * `Inicio` or `Analisis` puts their `screenRoute`s here, so the header the layout draws is
 * where the real table puts it.
 */

import type { RouteObject } from 'react-router'
import HomeLayout from '../screens/inicio/HomeLayout'

export function homeLayoutRoute(children: RouteObject[]): RouteObject {
  return { element: <HomeLayout />, children }
}
