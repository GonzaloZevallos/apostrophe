/**
 * The generic retry for a server error (`accounts.md`, "Feedback": "a server error
 * shows a generic retry"). Fixed copy, no data of its own, and never a refusal text
 * — a refusal would blame what the user typed, which is not what a 500 or an
 * unrecognised error body means.
 */

import { useTranslation } from 'react-i18next'
import AvisoAmbar from './AvisoAmbar'

/**
 * Re-exported for the screens that still set it as a form error; each area part moves its
 * own onto `t('common:genericError')`, and the last one deletes this line.
 */
export { ERROR_GENERICO_MENSAJE } from '../copy/common'

export default function ErrorGenerico() {
  const { t } = useTranslation()
  return (
    <AvisoAmbar attention role="alert">
      <span className="aviso-ambar__titulo">{t('common:genericError')}</span>
    </AvisoAmbar>
  )
}
