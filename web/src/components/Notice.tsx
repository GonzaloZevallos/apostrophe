/**
 * The fixed feedback banners after a write (plan, "Gone records" and
 * "Feedback"): a success toast or the gone notice, from `feedback.ts`'s closed
 * set. Neither carries an id, name, date or amount; both are announced the
 * same way, with no "Deshacer" and no "Reintentar". `kind` only changes the
 * colour token used (`--boton`/`--boton-texto` for a success toast, the amber
 * `aviso-ambar` for the gone notice), never a loose hex.
 */

import type { Feedback } from './feedback'

export default function Notice({ kind, message }: Feedback) {
  return (
    <div className={kind === 'toast' ? 'toast' : 'aviso-ambar'} role="status">
      <span className={kind === 'toast' ? 'toast__texto' : 'aviso-ambar__titulo'}>{message}</span>
    </div>
  )
}
