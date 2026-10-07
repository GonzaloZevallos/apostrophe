/**
 * Configuración → Integraciones (`ConfiguracionIntegraciones.dc.html`): the Telegram bot's
 * token, the channel chat and the own chat, and Probarlo, the only way they are saved
 * (pinned-catalog.md). Publicar and the pin's status are not here: they are `PinPublish` on
 * the catalog screen, which this group only links to.
 *
 * `accepted` is what the server last accepted, held in state, seeded once from the first
 * answer and reset from Probarlo's answer; `dirty` is measured against it and never against
 * the query cache. The typed token lives only in this component's state: it is in no query
 * key, URL, storage, toast or log, is cleared on a successful Probarlo and kept on a
 * refusal. Probarlo invalidates `keys.pinnedCatalog()`, which also reaches Inicio's notice
 * and the catalog screen's Publicar. Buscar mi chat only fills the own chat field from the
 * bot's messages and saves nothing, so the number it fills is a typed change like any other.
 */

import { type FormEvent, useEffect, useId, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import InAppLink from '../../components/InAppLink'
import { ApiError, NetworkError, get, post } from '../../api/client'
import { invalidateResource, keys } from '../../api/keys'
import { PINNED_CATALOG_REFUSAL_OVERRIDES, resolveOverride } from '../../api/refusals'
import AvisoExito, { type SuccessToast } from '../../components/AvisoExito'
import ErrorGenerico from '../../components/ErrorGenerico'
import SinConexion from '../../components/SinConexion'
import Loading from '../../components/Loading'
import SettingsGroup, { type LeaveWording } from './SettingsGroup'
import { CATALOG } from '../../routes'

const TITLE = 'Integraciones'
const TEST_SENT_TOAST: SuccessToast = 'Prueba enviada'
const PREVIOUS_PIN_NOTICE =
  'El mensaje fijado anterior queda como está; desfijalo vos en Telegram.'
const GENERIC_REFUSAL_MESSAGE = 'Revisá los datos e intentá de nuevo.'
const CHANNEL_CHAT_HELP = 'Es el @usuario o el enlace del canal donde se publica el catálogo.'
const OWN_CHAT_HELP =
  'Abrí tu bot en Telegram y tocá Iniciar. Tu número lo ves con @userinfobot, o tocá Buscar mi chat.'
const LOAD_THE_TOKEN_FIRST = 'Cargá el token primero'

const LEAVE: LeaveWording = {
  question: '¿Descartás el cambio?',
  detail: 'Se pierde lo que cargaste: todavía no se guardó nada.',
  keepLabel: 'No, seguí editando',
  discardLabel: 'Sí, descartalo',
}

interface PinnedCatalog {
  token_saved_on: string | null
  own_chat: string | null
  channel_chat: string | null
}

interface PinnedCatalogTestResult extends PinnedCatalog {
  previous_pin_left: boolean
}

interface OwnChatFound {
  own_chat: string
}

interface Accepted {
  tokenSavedOn: string | null
  ownChat: string
  channelChat: string
}

function acceptedFrom(answer: PinnedCatalog): Accepted {
  return {
    tokenSavedOn: answer.token_saved_on,
    ownChat: answer.own_chat ?? '',
    channelChat: answer.channel_chat ?? '',
  }
}

function formatDate(iso: string): string {
  const [, month, day] = iso.split('-')
  return `${day}/${month}`
}

function IntegrationsForm({ initial }: { initial: PinnedCatalog }) {
  const queryClient = useQueryClient()
  const fieldId = useId()
  const [accepted, setAccepted] = useState<Accepted>(() => acceptedFrom(initial))
  const [tokenChanging, setTokenChanging] = useState(false)
  const [tokenInput, setTokenInput] = useState('')
  const [ownChatInput, setOwnChatInput] = useState(accepted.ownChat)
  const [channelChatInput, setChannelChatInput] = useState(accepted.channelChat)
  const [previousPinLeft, setPreviousPinLeft] = useState(false)

  const [toast, setToast] = useState<SuccessToast | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [testOffline, setTestOffline] = useState(false)
  const [testing, setTesting] = useState(false)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (toast === null) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const tokenFieldOpen = tokenChanging || accepted.tokenSavedOn === null
  const dirty =
    tokenInput.trim() !== '' ||
    ownChatInput !== accepted.ownChat ||
    channelChatInput !== accepted.channelChat

  const typedToken = tokenFieldOpen && tokenInput.trim() !== '' ? tokenInput : null
  const canSearch = typedToken !== null || accepted.tokenSavedOn !== null

  function showRefusal(caught: unknown): void {
    if (caught instanceof ApiError) {
      setTestError(
        resolveOverride(PINNED_CATALOG_REFUSAL_OVERRIDES, caught.code) ?? GENERIC_REFUSAL_MESSAGE,
      )
    } else if (caught instanceof NetworkError) {
      setTestOffline(true)
    } else {
      setTestError(GENERIC_REFUSAL_MESSAGE)
    }
  }

  async function onSearchOwnChat(): Promise<void> {
    setTestError(null)
    setTestOffline(false)
    setSearching(true)
    try {
      // Reads only: nothing is saved, and a refusal leaves every field as it was.
      const found = await post<OwnChatFound>('/pinned-catalog/own-chat-lookup', {
        token: typedToken,
      })
      setOwnChatInput(found.own_chat)
    } catch (caught) {
      showRefusal(caught)
    } finally {
      setSearching(false)
    }
  }

  async function onProbarlo(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setTestError(null)
    setTestOffline(false)
    setPreviousPinLeft(false)
    setTesting(true)
    try {
      const result = await post<PinnedCatalogTestResult>('/pinned-catalog/test', {
        token: typedToken,
        own_chat: ownChatInput,
        channel_chat: channelChatInput.trim() === '' ? null : channelChatInput,
      })
      const next = acceptedFrom(result)
      setAccepted(next)
      setOwnChatInput(next.ownChat)
      setChannelChatInput(next.channelChat)
      setTokenChanging(false)
      setTokenInput('')
      setPreviousPinLeft(result.previous_pin_left)
      setToast(TEST_SENT_TOAST)
    } catch (caught) {
      // A refusal saves nothing and keeps everything typed, the token included.
      showRefusal(caught)
    } finally {
      setTesting(false)
      invalidateResource(queryClient, 'pinnedCatalog')
    }
  }

  return (
    <SettingsGroup title={TITLE} dirty={dirty} leave={LEAVE}>
      {toast !== null && <AvisoExito texto={toast} />}

      <form className="formulario" onSubmit={(event) => void onProbarlo(event)}>
        {tokenFieldOpen ? (
          <label className="campo">
            <span className="campo__rotulo">Token del bot</span>
            <input
              className="campo__input"
              type="password"
              autoComplete="off"
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
            />
          </label>
        ) : (
          <div className="catalogo__fila">
            <span className="catalogo__fila-texto">
              <span>Token del bot</span>
              <span className="catalogo__fila-detalle">
                Guardado el {formatDate(accepted.tokenSavedOn as string)} · no se muestra más
              </span>
            </span>
            <button type="button" className="boton-enlace" onClick={() => setTokenChanging(true)}>
              Cambiar
            </button>
          </div>
        )}

        <div className="campo">
          <label className="campo__rotulo" htmlFor={`${fieldId}-channel`}>
            Chat del canal
          </label>
          <input
            id={`${fieldId}-channel`}
            className="campo__input"
            type="text"
            aria-describedby={`${fieldId}-channel-help`}
            value={channelChatInput}
            onChange={(event) => setChannelChatInput(event.target.value)}
          />
          <span id={`${fieldId}-channel-help`} className="campo__ayuda">
            {CHANNEL_CHAT_HELP}
          </span>
        </div>

        <div className="campo">
          <label className="campo__rotulo" htmlFor={`${fieldId}-own`}>
            Tu chat
          </label>
          <div className="campo__fila">
            <input
              id={`${fieldId}-own`}
              className="campo__input"
              type="text"
              aria-describedby={`${fieldId}-own-help`}
              value={ownChatInput}
              onChange={(event) => setOwnChatInput(event.target.value)}
            />
            <button
              type="button"
              className="boton-enlace"
              disabled={!canSearch || searching}
              aria-describedby={canSearch ? undefined : `${fieldId}-search-help`}
              onClick={() => void onSearchOwnChat()}
            >
              Buscar mi chat
            </button>
          </div>
          <span id={`${fieldId}-own-help`} className="campo__ayuda">
            {OWN_CHAT_HELP}
          </span>
          {!canSearch && (
            <span id={`${fieldId}-search-help`} className="campo__ayuda">
              {LOAD_THE_TOKEN_FIRST}
            </span>
          )}
        </div>

        {testError !== null && (
          <span className="campo__error" role="alert">
            {testError}
          </span>
        )}
        {testOffline && <SinConexion />}
        {previousPinLeft && (
          <div className="aviso-ambar" role="status">
            <span className="aviso-ambar__detalle">{PREVIOUS_PIN_NOTICE}</span>
          </div>
        )}

        <button className="boton" type="submit" disabled={testing}>
          Probarlo
        </button>
      </form>

      <InAppLink to={CATALOG} className="boton--enlace">
        Ir al catálogo
      </InAppLink>
    </SettingsGroup>
  )
}

export default function IntegrationsGroup() {
  const query = useQuery({
    queryKey: keys.pinnedCatalog(),
    queryFn: () => get<PinnedCatalog>('/pinned-catalog'),
  })

  if (query.data !== undefined) return <IntegrationsForm initial={query.data} />

  return (
    <SettingsGroup title={TITLE} dirty={false} leave={LEAVE}>
      {query.isPending && <Loading />}
      {query.isError ? query.error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico /> : null}
    </SettingsGroup>
  )
}
