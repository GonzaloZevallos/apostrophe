/**
 * The fixed feedback banners after a write (plan, "Gone records" and
 * "Feedback"): a success toast or the gone notice, from `feedback.ts`'s closed
 * set. Neither carries an id, name, date or amount; both are announced the
 * same way, with no "Deshacer" and no "Reintentar". `kind` only changes the
 * colour token used (`--boton`/`--boton-texto` for a success toast, the amber
 * `aviso-ambar` for the gone notice), never a loose hex.
 *
 * It keeps its props shape, a spread `Feedback` (`kind` plus `message` or `refusal`). A toast
 * (and the saved marker) carries a `common:` key in `message`, resolved here with `t`; the gone
 * notice resolves its `Refusal` here, at render.
 */

import { useTranslation } from 'react-i18next'
import { refusalText } from '../i18n/refusalKeys'
import type { Feedback } from './feedback'

export default function Notice(feedback: Feedback) {
  const { t } = useTranslation()
  const text = feedback.kind === 'notice' ? refusalText(t, feedback.refusal) : t(feedback.message)
  return (
    <div className={feedback.kind === 'toast' ? 'toast' : 'aviso-ambar'} role="status">
      <span className={feedback.kind === 'toast' ? 'toast__texto' : 'aviso-ambar__titulo'}>{text}</span>
    </div>
  )
}
