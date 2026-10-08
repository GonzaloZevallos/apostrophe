/**
 * "Publicar" and the pin's status, on the catalog screen (`Catalogo.dc.html`, the card
 * under Compartir and Copiar). The bot settings and Probarlo live in Configuración →
 * Integraciones (`settings/IntegrationsGroup.tsx`); this component only reads
 * `GET /pinned-catalog` and publishes.
 *
 * Publicar is disabled exactly when `publish_blocked_by` is not null, and the reason in
 * words and the link to Integraciones come from that one field (invariant: never from the
 * status's reasons or from null fields). The status line never carries the link, and
 * Publicar stays enabled under every status reason.
 *
 * Publicar invalidates `keys.pinnedCatalog()` when it settles: that one prefix covers this
 * query and Inicio's status query (`keys.ts`), so Inicio's notice follows.
 */

import { SETTINGS_INTEGRATIONS } from '../routes'
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError, get, post } from '../api/client'
import { invalidateResource, keys } from '../api/keys'
import {
  PINNED_CATALOG_NOT_READY_REASON,
  PINNED_CATALOG_REASON_LABEL,
  PINNED_CATALOG_REFUSAL_OVERRIDES,
  resolveOverride,
  type PinReason,
} from '../api/refusals'
import AvisoExito, { type SuccessToast } from '../components/AvisoExito'
import SinConexion from '../components/SinConexion'
import Boton from '../components/Boton'
import { AvisoCuerpo } from '../components/AvisoAmbar'
import BotonLink from '../components/BotonLink'
import {
  CHANNEL_MISSING_LEAD,
  INTEGRATIONS_LINK_WORD,
  OUT_OF_DATE_SEPARATOR,
  OUT_OF_DATE_TITLE,
} from './pinPublishMessages'

const PUBLISHED_TOAST: SuccessToast = 'Catálogo publicado'
const GENERIC_REFUSAL_MESSAGE = 'Revisá los datos e intentá de nuevo.'
const INTEGRATIONS_PATH = SETTINGS_INTEGRATIONS

interface PinStatus {
  state: 'up_to_date' | 'out_of_date'
  reason: PinReason | null
  last_published_on: string | null
}

type PublishBlockedBy = 'not_tested' | 'channel_missing'

interface PinnedCatalog {
  publish_blocked_by: PublishBlockedBy | null
  status: PinStatus | null
}

function formatDate(iso: string): string {
  const [, month, day] = iso.split('-')
  return `${day}/${month}`
}

function StatusLine({ status }: { status: PinStatus }) {
  return (
    <div
      className={
        status.state === 'out_of_date'
          ? 'catalogo__publicar-estado catalogo__publicar-estado--atencion'
          : 'catalogo__publicar-estado'
      }
    >
      <AvisoCuerpo attention={status.state === 'out_of_date'}>
        <span className="catalogo__publicar-titulo">
          {status.state === 'up_to_date' ? 'Al día' : OUT_OF_DATE_TITLE}
        </span>
        {status.state === 'out_of_date' && status.reason !== null && (
          <span className="catalogo__publicar-detalle">
            {OUT_OF_DATE_SEPARATOR}
            {PINNED_CATALOG_REASON_LABEL[status.reason]}
          </span>
        )}
        {status.last_published_on !== null && (
          <span className="catalogo__publicar-detalle">
            {' '}
            · El último fue el {formatDate(status.last_published_on)}
          </span>
        )}
      </AvisoCuerpo>
    </div>
  )
}

function BlockedReason({ blockedBy }: { blockedBy: PublishBlockedBy }) {
  const link = (
    <BotonLink to={INTEGRATIONS_PATH} variant="link">
      {INTEGRATIONS_LINK_WORD}
    </BotonLink>
  )
  if (blockedBy === 'not_tested') {
    return (
      <span className="campo__ayuda">
        {PINNED_CATALOG_NOT_READY_REASON} · {link}
      </span>
    )
  }
  return (
    <span className="campo__ayuda">
      {CHANNEL_MISSING_LEAD}
      {link}
    </span>
  )
}

export default function PinPublish() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: keys.pinnedCatalog(),
    queryFn: () => get<PinnedCatalog>('/pinned-catalog'),
  })
  const data = query.data

  const [toast, setToast] = useState<SuccessToast | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [publishOffline, setPublishOffline] = useState(false)
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    if (toast === null) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  if (data === undefined) return null

  async function onPublicar(): Promise<void> {
    setPublishError(null)
    setPublishOffline(false)
    setPublishing(true)
    try {
      await post<PinnedCatalog>('/pinned-catalog/publish')
      setToast(PUBLISHED_TOAST)
    } catch (caught) {
      if (caught instanceof ApiError) {
        setPublishError(
          resolveOverride(PINNED_CATALOG_REFUSAL_OVERRIDES, caught.code) ?? GENERIC_REFUSAL_MESSAGE,
        )
      } else if (caught instanceof NetworkError) {
        setPublishOffline(true)
      } else {
        setPublishError(GENERIC_REFUSAL_MESSAGE)
      }
    } finally {
      setPublishing(false)
      // A failed Publicar records its failure server-side too, so the status follows
      // the last attempt: refetch on both paths.
      invalidateResource(queryClient, 'pinnedCatalog')
    }
  }

  const blockedBy = data.publish_blocked_by
  const outOfDate = data.status?.state === 'out_of_date'

  return (
    <div className={outOfDate ? 'catalogo__publicar catalogo__publicar--desactualizado' : 'catalogo__publicar'}>
      {toast !== null && <AvisoExito texto={toast} />}
      {data.status !== null && <StatusLine status={data.status} />}
      <Boton
        icon="publicar"
        disabled={blockedBy !== null || publishing}
        onClick={() => void onPublicar()}
      >
        Publicar
      </Boton>
      {blockedBy !== null && <BlockedReason blockedBy={blockedBy} />}
      {publishError !== null && (
        <span className="campo__error" role="alert">
          {publishError}
        </span>
      )}
      {publishOffline && <SinConexion />}
    </div>
  )
}
