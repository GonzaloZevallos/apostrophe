/**
 * A route of the real table for a test: the registry's path for the screen, its element and the
 * `handle.screen` `useLeafScreen` reads, as `router.tsx`'s `bind` writes it. A test that mounts
 * Inicio or Analisis builds its routes with this, since the segment control asks the leaf route
 * which screen it is on and has no fallback.
 */

import type { ReactElement } from 'react'
import type { RouteObject } from 'react-router'
import { screenOf, type ScreenId } from '../routes'

export function screenRoute(id: ScreenId, element: ReactElement): RouteObject {
  return { path: screenOf(id).path, element, handle: { screen: id } }
}
