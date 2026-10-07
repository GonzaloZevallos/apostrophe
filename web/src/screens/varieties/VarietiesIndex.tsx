/**
 * What `/varieties` itself shows: on a phone the list; on a computer (where the layout
 * already draws the list on the left) it selects the first variety by name with `replace`
 * once there is one, and shows nothing that could be read as data until then.
 */

import { Navigate } from 'react-router'
import { FOLLOWED_REDIRECT } from '../../flash/flashReducer'
import { VARIETY, pathTo } from '../../routes'
import { useViewport } from '../../shell/useViewport'
import Variedades from '../Variedades'
import { useSelectedVariety } from './useSelectedVariety'

export default function VarietiesIndex() {
  const computer = useViewport() === 'computer'
  const selected = useSelectedVariety()
  if (!computer) return <Variedades />
  if (selected === null) return null
  return <Navigate to={pathTo(VARIETY, { id: selected })} replace state={FOLLOWED_REDIRECT} />
}
