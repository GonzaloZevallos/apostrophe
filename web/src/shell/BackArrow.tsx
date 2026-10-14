/**
 * The "‹ <parent>" arrow every card shows, drawn from the parent `chromeOf` resolved (host
 * and facts already applied): the label and the fallback are one answer, so they cannot
 * disagree. Tapping it goes back through history when the entry is in-app, and to that same
 * parent (replacing the entry) when it is not (`useBackOr`). A parent with parameters
 * (`/varieties/:id`) is filled from the route's own.
 *
 * The row is always at its fixed height whenever there is an arrow; while the record's facts
 * are unknown it shows the live parent, and when they resolve only the label and target
 * change, never whether the arrow is there.
 */

import { useMatches } from 'react-router'
import BackButton from '../components/BackButton'
import { useBackOr } from '../components/useBackOr'
import { pathTo, type ParentRef } from '../routes'
import { leafParams } from './useScreenFacts'

export default function BackArrow({ parent }: { parent: ParentRef }) {
  const params = leafParams(useMatches())
  const back = useBackOr(pathTo(parent.path, params))
  return (
    <div className="flecha-atras">
      <BackButton title={parent.title} onClick={back} />
    </div>
  )
}
