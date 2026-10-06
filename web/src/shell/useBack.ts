/**
 * The one back rule (navigation.md, "Chrome and back"): back follows history, and with
 * no history it goes to the parent the "‹" names. A direct open or a refresh has
 * `location.key === 'default'`, the first entry of the session; any other key means
 * there is a screen before this one inside the app.
 *
 * Returns the click handler for a link whose `to` is the parent: with history it
 * cancels the link's own navigation and goes back, with none it lets the link go.
 */

import type { MouseEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'

export function useBack(): (event: MouseEvent<HTMLAnchorElement>) => void {
  const location = useLocation()
  const navigate = useNavigate()
  return (event) => {
    if (location.key === 'default') return
    // A new-tab click or a middle click is the browser's own.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return
    event.preventDefault()
    void navigate(-1)
  }
}
