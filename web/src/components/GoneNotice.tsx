/**
 * The gone-record notice (plan, "Gone records"): shown after a save or a delete
 * lands on a record that is already gone. A separate component from `AvisoExito`
 * (plan, invariants: "the gone notice and gone screen are separate components and
 * carry no data") — it must never look like a save went through, so it keeps the
 * neutral `.aviso-neutro` tone, never the success or warning ones.
 *
 * Renders bare, with no floating wrapper of its own: PRD round 3 asks for "the
 * same placement" as that screen's own success toast, and screens disagree on
 * what that placement is — Gastos/GastoCategorias's `Aviso` floats in
 * `.aviso-flotante`, VariedadDetalle's `AvisoExito` stays inline in `.cuerpo`. So
 * the screen wraps this component (or doesn't) to match its own toast, instead of
 * `GoneNotice` hard-coding one placement for every screen (review finding, e2e).
 */

import { useTranslation } from 'react-i18next'
import { GONE_NOTICE } from '../api/refusals'
import { refusalText } from '../i18n/refusalKeys'

export default function GoneNotice() {
  const { t } = useTranslation()
  return (
    <div className="aviso-neutro" role="status">
      <span className="aviso-neutro__texto">{refusalText(t, GONE_NOTICE)}</span>
    </div>
  )
}
