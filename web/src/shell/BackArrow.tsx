/**
 * The "‹ <parent>" arrow every card shows. The word is the screen's fixed parent, from
 * `parentOf(id, viewport)`; tapping it goes back through history when the entry is in-app,
 * and to that same parent (replacing the entry) when it is not (`useBackOr`). The label and
 * the fallback are one registry answer, so they cannot disagree.
 */

import Boton from '../components/Boton'
import { useBackOr } from '../components/useBackOr'
import { HOME, parentOf, type ScreenId } from '../routes'
import { useViewport } from './useViewport'

export default function BackArrow({ id }: { id: ScreenId }) {
  const parent = parentOf(id, useViewport())
  const back = useBackOr(parent?.path ?? HOME)
  if (parent === undefined) return null
  return (
    <div className="flecha-atras">
      <Boton variant="link" onClick={back}>
        {`‹ ${parent.title}`}
      </Boton>
    </div>
  )
}
