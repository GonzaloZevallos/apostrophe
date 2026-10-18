/**
 * The after-import notice (navigation.md): "Conectá el bot para que el catálogo fijado se
 * actualice solo", with the attention icon, and a dismiss control. The dismissal is the
 * business's: it sends `POST /first-run/import-notice/dismissal`, then asks `/first-run`
 * again, which no longer answers the notice. A failure keeps the notice and says so.
 */

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { NetworkError } from '../../api/client'
import { sendImportNoticeDismissal } from '../../api/firstRun'
import { keys } from '../../api/keys'
import { AvisoCuerpo } from '../../components/AvisoAmbar'
import Boton from '../../components/Boton'
import ErrorGenerico from '../../components/ErrorGenerico'
import SinConexion from '../../components/SinConexion'
import { IMPORT_NOTICE, IMPORT_NOTICE_DISMISS } from '../inicioMessages'

export default function ImportNotice() {
  const queryClient = useQueryClient()
  const [failure, setFailure] = useState<'offline' | 'error' | null>(null)

  async function dismiss(): Promise<void> {
    setFailure(null)
    try {
      await sendImportNoticeDismissal()
      await queryClient.invalidateQueries({ queryKey: keys.firstRun() })
    } catch (caught) {
      setFailure(caught instanceof NetworkError ? 'offline' : 'error')
    }
  }

  return (
    <>
      <div className="aviso-ambar aviso-ambar--atencion aviso-importado" role="status">
        <AvisoCuerpo attention>
          <span className="aviso-ambar__titulo" data-copy="notice">
            {IMPORT_NOTICE}
          </span>
        </AvisoCuerpo>
        <Boton variant="icon" action="close" ariaLabel={IMPORT_NOTICE_DISMISS} onClick={() => void dismiss()} />
      </div>
      {failure === 'offline' && <SinConexion />}
      {failure === 'error' && <ErrorGenerico />}
    </>
  )
}
