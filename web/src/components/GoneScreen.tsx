/**
 * Shown instead of a detail screen for a record that is gone (plan, "Gone
 * records"): "Eso ya no está.", with no id, name, date or amount — it reads the
 * same whatever was deleted, foreign, or never existed (ADR-0004). `label` and `to`
 * name only the list to go back to; the word is the registry's title for `to` (the same one the
 * shell's "‹ X" arrow shows), and `label` is only the fallback for a path the registry lacks.
 */

import BotonLink from './BotonLink'
import { backTo } from '../copy/common'
import { GONE_DETAIL } from '../copy/refusals'
import { SCREENS } from '../routes'

export default function GoneScreen({ label, to }: { label: string; to: string }) {
  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div className="estado-vacio">
          <span className="estado-vacio__titulo">{GONE_DETAIL}</span>
          <BotonLink variant="primary" icon="atras" to={to}>
            {backTo(SCREENS.find((entry) => entry.path === to)?.title ?? label)}
          </BotonLink>
        </div>
      </div>
    </main>
  )
}
