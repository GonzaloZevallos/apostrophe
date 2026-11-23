/**
 * What the flash toast shows for the result of an Undo. It lives apart from `AvisoExito.tsx`
 * because it renders a success, an amber and an error element, and that module is the success
 * toast's alone. Each result is one existing element; no action prop, so no button.
 *
 * `offline` and `failed` do not reuse `SinConexion` / `ErrorGenerico`: their "try again" would
 * be wrong here, where the sale is still saved and the way back is its detail in Sales. They
 * keep the amber box with the Attention icon, with their own sentence and no Sale name.
 */

import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { GONE_NOTICE } from '../api/refusals'
import AvisoAmbar from '../components/AvisoAmbar'
import AvisoExito from '../components/AvisoExito'
import Notice from '../components/Notice'
import type { UndoResult } from './flashReducer'

export default function UndoResultToast({ result }: { result: UndoResult }): ReactElement {
  const { t } = useTranslation()
  switch (result) {
    case 'deleted':
      return <AvisoExito texto="common:saleDeletedGramsBack" />
    case 'gone':
      return <Notice kind="notice" refusal={GONE_NOTICE} />
    case 'offline':
      return (
        <AvisoAmbar attention role="status">
          <span className="aviso-ambar__titulo">{t('common:undoSaleOffline')}</span>
        </AvisoAmbar>
      )
    case 'failed':
      return (
        <AvisoAmbar attention role="alert">
          <span className="aviso-ambar__titulo">{t('common:undoSaleFailed')}</span>
        </AvisoAmbar>
      )
  }
}
