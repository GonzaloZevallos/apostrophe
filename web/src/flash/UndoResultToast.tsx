/**
 * What the flash toast shows for the result of an Undo. It lives apart from `AvisoExito.tsx`
 * because it renders a success, an amber and an error element, and that module is the success
 * toast's alone. Each result is one existing element, unchanged; no action prop, so no button.
 */

import type { ReactElement } from 'react'
import { GONE_NOTICE } from '../api/refusals'
import AvisoExito from '../components/AvisoExito'
import ErrorGenerico from '../components/ErrorGenerico'
import Notice from '../components/Notice'
import SinConexion from '../components/SinConexion'
import type { UndoResult } from './flashReducer'

export default function UndoResultToast({ result }: { result: UndoResult }): ReactElement {
  switch (result) {
    case 'deleted':
      return <AvisoExito texto="common:saleDeletedGramsBack" />
    case 'gone':
      return <Notice kind="notice" refusal={GONE_NOTICE} />
    case 'offline':
      return <SinConexion />
    case 'failed':
      return <ErrorGenerico />
  }
}
