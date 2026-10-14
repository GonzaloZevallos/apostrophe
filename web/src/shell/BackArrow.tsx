/**
 * The "‹ <parent>" arrow every card shows. The word is the screen's fixed parent, from
 * `resolveParent(id, viewport, facts)`; tapping it goes back through history when the entry is in-app,
 * and to that same parent (replacing the entry) when it is not (`useBackOr`). The label and
 * the fallback are one registry answer, so they cannot disagree.
 */

import Boton from '../components/Boton'
import { useBackOr } from '../components/useBackOr'
import { HOME, resolveParent, type ScreenFacts, type ScreenId } from '../routes'
import { useViewport } from './useViewport'

// No source of facts yet (the chrome subtask brings `useScreenFacts`): the live parent.
const NO_FACTS: ScreenFacts = { archived: 'unknown', varietyName: null }

export default function BackArrow({ id }: { id: ScreenId }) {
  const parent = resolveParent(id, useViewport(), NO_FACTS)
  const back = useBackOr(parent?.path ?? HOME)
  if (parent === undefined) return null
  return (
    <div className="flecha-atras">
      <Boton variant="back" onClick={back}>
        {`‹ ${parent.title}`}
      </Boton>
    </div>
  )
}
