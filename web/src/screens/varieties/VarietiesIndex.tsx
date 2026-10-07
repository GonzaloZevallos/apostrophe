/**
 * What `/varieties` itself shows: on a phone the list; on a computer (where the layout
 * already draws the list on the left) it selects the first variety by name with `replace`
 * once there is one, and shows nothing that could be read as data until then.
 */

import { Navigate } from 'react-router'
import { FOLLOWED_REDIRECT } from '../../flash/flashReducer'
import { useIsComputer } from '../../components/useIsComputer'
import { VARIETY } from '../../legacyVarietyPaths'
import Variedades from '../Variedades'
import { useSelectedVariety } from './useSelectedVariety'

export default function VarietiesIndex() {
  const computer = useIsComputer()
  const selected = useSelectedVariety()
  if (!computer) return <Variedades />
  if (selected === null) return null
  return <Navigate to={VARIETY(selected)} replace state={FOLLOWED_REDIRECT} />
}
