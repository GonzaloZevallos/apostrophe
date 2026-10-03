/**
 * The gone-record notice (plan, "Gone records"): shown after a save or a delete
 * lands on a record that is already gone. A separate component from `AvisoExito`
 * (plan, invariants: "the gone notice and gone screen are separate components and
 * carry no data") — it must never look like a save went through, so it keeps the
 * neutral `.aviso-neutro` tone, never the success or warning ones.
 *
 * Floats in `.aviso-flotante`, the same fixed slot `Aviso` (the expenses screens'
 * success toast) uses (PRD round 3: "It uses the same placement [as a toast]…").
 * review finding, e2e: the merge that brought the screen subtasks together had
 * dropped this wrapper, so the notice rendered inline at the bottom of the page
 * instead of in that slot.
 */

import { GONE_NOTICE } from '../api/refusals'

export default function GoneNotice() {
  return (
    <div className="aviso-flotante">
      <div className="aviso-neutro" role="status">
        <span className="aviso-neutro__texto">{GONE_NOTICE}</span>
      </div>
    </div>
  )
}
