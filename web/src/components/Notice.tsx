/**
 * The fixed feedback banners after a write (plan, "Gone records" and
 * "Feedback"): a success toast or the gone notice, from `feedback.ts`'s closed
 * set. Neither carries an id, name, date or amount; both are announced the
 * same way, with no "Deshacer" and no "Reintentar". `kind` only changes the
 * colour token used (`--boton`/`--boton-texto` for a success toast, the amber
 * `aviso-ambar` for the gone notice), never a loose hex.
 *
 * It takes the whole `Feedback` as one prop, not spread: a `key` field would be swallowed by
 * React if it were passed as a prop. A toast (and the saved marker) carries a `common:` key,
 * resolved here with `t`; the gone notice is still text until the refusals part moves it to a key.
 */

import { useTranslation } from 'react-i18next'
import type { Feedback } from './feedback'

export default function Notice({ feedback }: { feedback: Feedback }) {
  const { t } = useTranslation()
  const text = feedback.kind === 'notice' ? feedback.message : t(feedback.key)
  return (
    <div className={feedback.kind === 'toast' ? 'toast' : 'aviso-ambar'} role="status">
      <span className={feedback.kind === 'toast' ? 'toast__texto' : 'aviso-ambar__titulo'}>{text}</span>
    </div>
  )
}
