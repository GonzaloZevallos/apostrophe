/**
 * The registry entry of the leaf route: the deepest match that declares a `handle.screen`.
 * The shell reads it for the bar and the rail, and `HomeViewSwitch` for its marked option, so
 * both take the screen the same way and never from the pathname. A leaf with no screen is a bug
 * in the route table, so it throws: there is no fallback.
 */

import { useMatches } from 'react-router'
import { isScreenId, screenOf, type Screen } from '../routes'

export function useLeafScreen(): Screen {
  const matches = useMatches()
  for (const match of [...matches].reverse()) {
    const { handle } = match
    if (typeof handle === 'object' && handle !== null && 'screen' in handle && isScreenId(handle.screen)) {
      return screenOf(handle.screen)
    }
  }
  throw new Error('Shell: the leaf route does not declare a screen (routes.ts)')
}
