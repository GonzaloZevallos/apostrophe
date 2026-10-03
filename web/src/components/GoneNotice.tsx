/**
 * Shown after a save or a delete lands on a record that is gone (plan, "Gone
 * records"; PM round 3): the fixed line alone, no data of its own, never a success
 * toast — it must not look like a save went through, so it keeps the amber tone of
 * a notice, not the dark success toast (`Aviso`).
 */

import { GONE_NOTICE } from '../api/refusals'

export default function GoneNotice() {
  return (
    <div className="aviso-flotante">
      <div className="aviso-ambar" role="status">
        <span className="aviso-ambar__titulo">{GONE_NOTICE}</span>
      </div>
    </div>
  )
}
