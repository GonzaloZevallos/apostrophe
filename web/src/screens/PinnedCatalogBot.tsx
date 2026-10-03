/**
 * "El bot de Telegram" (plan, "Front"; `Catalogo.dc.html`'s lower part): the bot
 * settings, Probarlo and Publicar, and the status line, self-contained so
 * `Catalogo.tsx` only renders it. Fetches `GET /pinned-catalog` itself and keeps its
 * own local state for the three typed fields — the token is never prefilled
 * (CODING_STANDARDS §9/§10: the token never appears on screen once saved), and the
 * two chats start from the saved values, then follow what the seller types.
 *
 * Probarlo and Publicar each invalidate `keys.pinnedCatalog()` when they settle
 * (plan: "invalidate the pinned-catalog and status queries") — that one prefix
 * covers both Catálogo's own settings query and Inicio's status query
 * (`keys.ts`), so Inicio's notice follows without a query of its own here.
 */

import { type FormEvent, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError, post, get } from '../api/client'
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

const TEST_SENT_TOAST: SuccessToast = 'Prueba enviada'
const PUBLISHED_TOAST: SuccessToast = 'Catálogo publicado'
const PUBLISH_GATE_REASON = PINNED_CATALOG_NOT_READY_REASON
const PREVIOUS_PIN_NOTICE =
  'El mensaje fijado anterior queda como está; desfijalo vos en Telegram.'
const GENERIC_REFUSAL_MESSAGE = 'Revisá los datos e intentá de nuevo.'
const OWN_CHAT_HELP =
  'Escribile /start a tu bot y poné acá tu número de chat (te lo da @userinfobot).'
const CHANNEL_CHAT_HELP = 'El @usuario del canal o su número. Tu bot tiene que ser admin.'

interface PinStatus {
  state: 'up_to_date' | 'out_of_date'
  reason: PinReason | null
  last_published_on: string | null
}

interface PinnedCatalog {
  token_saved_on: string | null
  own_chat: string | null
  channel_chat: string | null
  can_publish: boolean
  status: PinStatus | null
}

interface PinnedCatalogTestResult extends PinnedCatalog {
  previous_pin_left: boolean
}

function formatDate(iso: string): string {
  const [, month, day] = iso.split('-')
  return `${day}/${month}`
}

function StatusLine({ status }: { status: PinStatus | null }) {
  if (status === null) return null
  return (
    <div>
      <span>{status.state === 'up_to_date' ? 'Al día' : 'Desactualizado'}</span>
      {status.state === 'out_of_date' && status.reason !== null && (
        <span> · {PINNED_CATALOG_REASON_LABEL[status.reason]}</span>
      )}
      {status.last_published_on !== null && (
        <span> · El último fue el {formatDate(status.last_published_on)}</span>
      )}
    </div>
  )
}

export default function PinnedCatalogBot() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: keys.pinnedCatalog(),
    queryFn: () => get<PinnedCatalog>('/pinned-catalog'),
  })
  const data = query.data

  const [tokenChanging, setTokenChanging] = useState(false)
  const [tokenInput, setTokenInput] = useState('')
  const [ownChatInput, setOwnChatInput] = useState<string | null>(null)
  const [channelChatInput, setChannelChatInput] = useState<string | null>(null)
  const [previousPinLeft, setPreviousPinLeft] = useState(false)

  const [toast, setToast] = useState<SuccessToast | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [testOffline, setTestOffline] = useState(false)
  const [testing, setTesting] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [publishOffline, setPublishOffline] = useState(false)
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    if (toast === null) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  if (data === undefined) return null

  // Local edits take over once the seller types; until then, the saved value shows
  // (no effect needed to "seed" these from the query — deriving them at render time
  // means there is nothing to re-synchronise when the query refetches).
  const ownChatValue = ownChatInput ?? data.own_chat ?? ''
  const channelChatValue = channelChatInput ?? data.channel_chat ?? ''
  const tokenFieldOpen = tokenChanging || data.token_saved_on === null
  // "Changing any of the three re-arms the test gate" (PRD, Bot settings): opening
  // the token field counts as a pending change, same as typing a new chat.
  const typedDiffersFromSaved =
    tokenFieldOpen || ownChatValue !== (data.own_chat ?? '') || channelChatValue !== (data.channel_chat ?? '')
  const publishDisabled = !data.can_publish || typedDiffersFromSaved

  async function onProbarlo(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setTestError(null)
    setTestOffline(false)
    setPreviousPinLeft(false)
    setTesting(true)
    try {
      const result = await post<PinnedCatalogTestResult>('/pinned-catalog/test', {
        token: tokenFieldOpen && tokenInput.trim() !== '' ? tokenInput : null,
        own_chat: ownChatValue,
        channel_chat: channelChatValue.trim() === '' ? null : channelChatValue,
      })
      setTokenChanging(false)
      setTokenInput('')
      setOwnChatInput(result.own_chat ?? '')
      setChannelChatInput(result.channel_chat ?? '')
      setPreviousPinLeft(result.previous_pin_left)
      setToast(TEST_SENT_TOAST)
    } catch (caught) {
      if (caught instanceof ApiError) {
        const message =
          resolveOverride(PINNED_CATALOG_REFUSAL_OVERRIDES, caught.code) ?? GENERIC_REFUSAL_MESSAGE
        setTestError(message)
      } else if (caught instanceof NetworkError) {
        setTestOffline(true)
      } else {
        setTestError(GENERIC_REFUSAL_MESSAGE)
      }
    } finally {
      setTesting(false)
      // Default `refetchType` ('active'): Catálogo's own settings query is mounted
      // right here, and a failed attempt records its outcome server-side too (the
      // plan: "A failed Publicar also records its failure, so the status follows the
      // last attempt") — `'none'` would leave the status line showing the previous
      // state until an unrelated remount or refocus.
      invalidateResource(queryClient, 'pinnedCatalog')
    }
  }

  async function onPublicar(): Promise<void> {
    setPublishError(null)
    setPublishOffline(false)
    setPublishing(true)
    try {
      await post<PinnedCatalog>('/pinned-catalog/publish')
      setToast(PUBLISHED_TOAST)
    } catch (caught) {
      if (caught instanceof ApiError) {
        const message =
          resolveOverride(PINNED_CATALOG_REFUSAL_OVERRIDES, caught.code) ?? GENERIC_REFUSAL_MESSAGE
        setPublishError(message)
      } else if (caught instanceof NetworkError) {
        setPublishOffline(true)
      } else {
        setPublishError(GENERIC_REFUSAL_MESSAGE)
      }
    } finally {
      setPublishing(false)
      invalidateResource(queryClient, 'pinnedCatalog')
    }
  }

  return (
    <div>
      <span className="rotulo">El bot de Telegram</span>
      {toast !== null && <AvisoExito texto={toast} />}

      <form className="formulario" onSubmit={(event) => void onProbarlo(event)}>
        {tokenFieldOpen ? (
          <label className="campo">
            <span className="campo__rotulo">Token</span>
            <input
              className="campo__input"
              type="password"
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
            />
          </label>
        ) : (
          <div className="catalogo__fila">
            <span className="catalogo__fila-texto">
              <span className="campo__rotulo">Token</span>
              <span>
                Guardado el {formatDate(data.token_saved_on as string)} · no se muestra más
              </span>
            </span>
            <button type="button" className="boton-enlace" onClick={() => setTokenChanging(true)}>
              Cambiar
            </button>
          </div>
        )}

        <label className="campo">
          <span className="campo__rotulo">Tu chat</span>
          <input
            className="campo__input"
            type="text"
            value={ownChatValue}
            onChange={(event) => setOwnChatInput(event.target.value)}
          />
          <span className="campo__ayuda">{OWN_CHAT_HELP}</span>
        </label>

        <label className="campo">
          <span className="campo__rotulo">Chat del canal</span>
          <input
            className="campo__input"
            type="text"
            value={channelChatValue}
            onChange={(event) => setChannelChatInput(event.target.value)}
          />
          <span className="campo__ayuda">{CHANNEL_CHAT_HELP}</span>
        </label>

        {testError !== null && (
          <span className="campo__error" role="alert">
            {testError}
          </span>
        )}
        {testOffline && <SinConexion />}
        {previousPinLeft && (
          <div className="aviso-ambar" role="status">
            <span className="aviso-ambar__titulo">{PREVIOUS_PIN_NOTICE}</span>
          </div>
        )}

        <button className="boton" type="submit" disabled={testing}>
          Probarlo
        </button>
      </form>

      <button
        type="button"
        className="boton"
        disabled={publishDisabled || publishing}
        onClick={() => void onPublicar()}
      >
        Publicar
      </button>
      {publishDisabled && <span className="campo__ayuda">{PUBLISH_GATE_REASON}</span>}
      {publishError !== null && (
        <span className="campo__error" role="alert">
          {publishError}
        </span>
      )}
      {publishOffline && <SinConexion />}

      <StatusLine status={data.status} />
    </div>
  )
}
