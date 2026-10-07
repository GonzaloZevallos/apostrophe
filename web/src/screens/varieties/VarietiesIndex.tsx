/**
 * What `/varieties` itself shows: on a phone the list; on a computer (where the layout
 * already draws the list on the left) it selects the first variety by name with `replace`
 * once there is one, and shows nothing that could be read as data until then.
 *
 * The selection never takes over a navigation the seller already started. A tap that leaves
 * Variedades (e.g. "Mandar catálogo" on the phone) pushes its entry at once, but React Router
 * renders the new screen in a transition; if the viewport turns computer in between, this
 * index re-renders with the old location and a bare `<Navigate replace>` would overwrite the
 * entry the tap just pushed. So the redirect runs from an effect that first checks the
 * browser's history is still on the entry this index rendered for (`isStillCurrent`).
 */

import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { FOLLOWED_REDIRECT } from '../../flash/flashReducer'
import { VARIETY, pathTo } from '../../routes'
import { useViewport } from '../../shell/useViewport'
import Variedades from '../Variedades'
import { isStillCurrent } from './isStillCurrent'
import { useSelectedVariety } from './useSelectedVariety'

export default function VarietiesIndex() {
  const computer = useViewport() === 'computer'
  const selected = useSelectedVariety()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!computer || selected === null) return
    if (!isStillCurrent(location, window.history.state)) return
    void navigate(pathTo(VARIETY, { id: selected }), { replace: true, state: FOLLOWED_REDIRECT })
  }, [computer, selected, location, navigate])

  if (!computer) return <Variedades />
  return null
}
