/**
 * The gone-record notice (plan, "Gone records"): shown after a save or a delete
 * lands on a record that is already gone. A separate component from `AvisoExito`
 * (plan, invariants: "the gone notice and gone screen are separate components and
 * carry no data") — it must never look like a save went through.
 */

import { GONE_NOTICE } from '../api/refusals'

export default function GoneNotice() {
  return (
    <div className="aviso-neutro" role="status">
      <span className="aviso-neutro__texto">{GONE_NOTICE}</span>
    </div>
  )
}
