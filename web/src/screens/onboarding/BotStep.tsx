/**
 * Step 4, "Conectá tu bot de Telegram": the owner's integrations form without its link to
 * the catalog, and the line that says where the catalog is published. A successful Probarlo
 * (the only save) passes the step as `done`; a failed one shows its reason and sends
 * nothing. A bot saved earlier shows "Hecho" and "Seguir". "Saltar" belongs to the frame.
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { NetworkError, get } from '../../api/client'
import { keys } from '../../api/keys'
import { sendPass } from '../../api/onboarding'
import ErrorGenerico from '../../components/ErrorGenerico'
import Loading from '../../components/Loading'
import SinConexion from '../../components/SinConexion'
import { IntegrationsForm, type PinnedCatalog } from '../settings/IntegrationsGroup'
import StepSubmit from './StepSubmit'
import { useOnboardingWrite } from './useOnboardingWrite'
import type { StepBodyProps } from './stepBodies'

export const PUBLISH_LINE = 'Cuando quieras, publicalo desde Variedades → Mandar catálogo'

export default function BotStep({ progress, onDirtyChange, onProgress }: StepBodyProps) {
  const query = useQuery({
    queryKey: keys.pinnedCatalog(),
    queryFn: () => get<PinnedCatalog>('/pinned-catalog'),
  })
  const [tested, setTested] = useState(false)
  const { run, sending, notice } = useOnboardingWrite(onProgress)
  const done = progress.steps.find((item) => item.step === 'bot')?.state === 'done'
  const send = () => run(() => sendPass('bot', 'done'))

  if (query.data === undefined) {
    if (query.isError) return query.error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />
    return <Loading />
  }
  return (
    <>
      {(done || tested) && <span className="onboarding__insignia">Hecho</span>}
      <IntegrationsForm
        initial={query.data}
        showCatalogLink={false}
        onDirtyChange={onDirtyChange}
        onSaved={() => {
          setTested(true)
          void send()
        }}
      />
      <p className="pie">{PUBLISH_LINE}</p>
      {(done || tested) && (
        <StepSubmit disabled={sending} onSubmit={() => void send()}>
          Seguir
        </StepSubmit>
      )}
      {notice}
    </>
  )
}
