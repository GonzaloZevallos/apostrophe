/**
 * Whether the viewport is a computer's (the design's 900 px breakpoint, the one the CSS
 * switches the rail and the bar on). Kept current, so a screen that draws two panes there
 * and one pane on a phone follows a resize. `useViewport` is the one that asks the browser.
 */

import { useViewport } from '../shell/useViewport'

export function useIsComputer(): boolean {
  return useViewport() === 'computer'
}
