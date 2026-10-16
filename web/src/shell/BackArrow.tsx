/**
 * The "‹ <parent>" arrow every card shows. The word is the screen's parent from
 * `parentOf(id, viewport, record)`; tapping it goes back through history when the entry is
 * in-app, and to that same parent (replacing the entry) when it is not (`useBackOr`). The
 * label and the fallback are one `parentOf` answer, so they cannot disagree.
 *
 * A parent varies only by the card's record, matched on the route's `:id`, never by how the
 * screen was reached: the published record (`useCardRecord.ts`) is used only when its id is the
 * route's, so a switch from variety A to B never shows A's archived parent or name while B
 * loads. Otherwise (loading, error, gone) the static registry parent is drawn, so the arrow is
 * always there, from the first render. The fallback path is read when the arrow is tapped,
 * from the latest answer, because the record may arrive after the render the seller saw (ADR-0045).
 */

import { useEffect, useRef } from 'react'
import { useParams } from 'react-router'
import Boton from '../components/Boton'
import { useBackOr } from '../components/useBackOr'
import { HOME, parentOf, pathTo, type ScreenId } from '../routes'
import { usePublishedCardRecord } from './useCardRecord'
import { useViewport } from './useViewport'

export default function BackArrow({ id }: { id: ScreenId }) {
  const published = usePublishedCardRecord()
  const params = useParams()
  const record = published !== undefined && published.id === Number(params.id) ? published : undefined
  const parent = parentOf(id, useViewport(), record)
  const target = useRef<() => string>(() => HOME)
  useEffect(() => {
    target.current = () => {
      if (parent === undefined) return HOME
      const filled: Record<string, string> = {}
      for (const [name, value] of Object.entries(params)) if (value !== undefined) filled[name] = value
      return pathTo(parent.path, filled)
    }
  })
  const back = useBackOr(() => target.current())
  if (parent === undefined) return null
  return (
    <div className="flecha-atras">
      <Boton variant="back" onClick={back}>
        {`‹ ${parent.title}`}
      </Boton>
    </div>
  )
}
