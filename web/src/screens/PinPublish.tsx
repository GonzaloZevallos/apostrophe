/**
 * "Publish" and the pin's status, on the catalog screen (`Catalogo.dc.html`, the card
 * under Compartir and Copiar). The bot settings and Probarlo live in Configuración →
 * Integraciones (`settings/IntegrationsGroup.tsx`); this component only reads
 * `GET /pinned-catalog` and publishes through `usePublishCatalog`.
 *
 * Publicar is disabled exactly when `publish_blocked_by` is not null, and the reason in
 * words and the link to Integraciones come from that one field (invariant: never from the
 * status's reasons or from null fields). The status line never carries the link, and
 * Publicar stays enabled under every status reason.
 *
 * `usePublishCatalog` invalidates `keys.pinnedCatalog()` when Publicar settles: that one prefix
 * covers this query and Inicio's status query (`keys.ts`), so Inicio's notice follows.
 */

import { SETTINGS_INTEGRATIONS } from '../routes'
import { useQuery } from '@tanstack/react-query'
import { keys } from '../api/keys'
import { readPinnedCatalog, type PinStatus, type PublishBlockedBy } from '../api/pinnedCatalog'
import {
  PINNED_CATALOG_NOT_READY_REASON,
  PINNED_CATALOG_REASON_LABEL,
} from '../api/refusals'
import AvisoExito from '../components/AvisoExito'
import SinConexion from '../components/SinConexion'
import Boton from '../components/Boton'
import { AvisoCuerpo } from '../components/AvisoAmbar'
import BotonLink from '../components/BotonLink'
import {
  CHANNEL_MISSING_LEAD,
  INTEGRATIONS_LINK_WORD,
  OUT_OF_DATE_JOINER,
  OUT_OF_DATE_TITLE, PINNED_CATALOG_TEXT,
} from '../copy/pinnedCatalog'
import { useTranslation } from 'react-i18next'
import { refusalText } from '../i18n/refusalKeys'
import { usePublishCatalog } from './usePublishCatalog'

const INTEGRATIONS_PATH = SETTINGS_INTEGRATIONS

function formatDate(iso: string): string {
  const [, month, day] = iso.split('-')
  return `${day}/${month}`
}

function StatusLine({ status }: { status: PinStatus }) {
  const { t } = useTranslation()
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
          {status.state === 'up_to_date' ? PINNED_CATALOG_TEXT.upToDate : OUT_OF_DATE_TITLE}
        </span>
        {status.state === 'out_of_date' && status.reason !== null && (
          <span className="catalogo__publicar-detalle">
            {OUT_OF_DATE_JOINER}
            {refusalText(t, PINNED_CATALOG_REASON_LABEL[status.reason])}
          </span>
        )}
        {status.last_published_on !== null && (
          <span className="catalogo__publicar-detalle">
            {' '}
            {PINNED_CATALOG_TEXT.theLastOneWasOn}{formatDate(status.last_published_on)}
          </span>
        )}
      </AvisoCuerpo>
    </div>
  )
}

function BlockedReason({ blockedBy }: { blockedBy: PublishBlockedBy }) {
  const { t } = useTranslation()
  const link = (
    <BotonLink to={INTEGRATIONS_PATH} variant="link">
      {INTEGRATIONS_LINK_WORD}
    </BotonLink>
  )
  if (blockedBy === 'not_tested') {
    return (
      <span className="campo__ayuda">
        {refusalText(t, PINNED_CATALOG_NOT_READY_REASON)}{OUT_OF_DATE_JOINER}{link}
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
  const query = useQuery({
    queryKey: keys.pinnedCatalog(),
    queryFn: readPinnedCatalog,
  })
  const data = query.data
  const { publish, publishing, outcome, toast } = usePublishCatalog()

  if (data === undefined) return null

  const blockedBy = data.publish_blocked_by
  const outOfDate = data.status?.state === 'out_of_date'

  return (
    <div className={outOfDate ? 'catalogo__publicar catalogo__publicar--desactualizado' : 'catalogo__publicar'}>
      {toast !== null && <AvisoExito texto={toast} />}
      {data.status !== null && <StatusLine status={data.status} />}
      <Boton
        icon="publicar"
        disabled={blockedBy !== null || publishing}
        onClick={() => void publish()}
      >
        {PINNED_CATALOG_TEXT.publish}
      </Boton>
      {blockedBy !== null && <BlockedReason blockedBy={blockedBy} />}
      {(outcome.kind === 'refused' || outcome.kind === 'failed') && (
        <span className="campo__error" role="alert">
          {outcome.text}
        </span>
      )}
      {outcome.kind === 'offline' && <SinConexion />}
    </div>
  )
}
