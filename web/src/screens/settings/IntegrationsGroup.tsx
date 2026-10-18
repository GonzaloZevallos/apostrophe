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

import { type FormEvent, type KeyboardEvent, useEffect, useId, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError, get, post } from '../../api/client'
import { invalidateResource, keys } from '../../api/keys'
import { PINNED_CATALOG_REFUSAL_OVERRIDES } from '../../copy/refusals'
import { resolveOverride } from '../../api/refusals'
import AvisoExito, { type SuccessToast } from '../../components/AvisoExito'
import ErrorGenerico from '../../components/ErrorGenerico'
import SinConexion from '../../components/SinConexion'
import Loading from '../../components/Loading'
import SettingsGroup from './SettingsGroup'
import Boton from '../../components/Boton'
import BotonLink from '../../components/BotonLink'
import MasInfo from '../../components/MasInfo'
import { CATALOG } from '../../routes'
import {
  BOT_TOKEN_LABEL,
  CHANGE,
  CHANNEL_CHAT_HELP,
  CHANNEL_CHAT_LABEL,
  FIND_MY_CHAT,
  GO_TO_CATALOG,
  GROUP_INTEGRATIONS,
  LEAVE_CHANGE,
  LOAD_THE_TOKEN_FIRST,
  OWN_CHAT_INFO,
  OWN_CHAT_LABEL,
  PREVIOUS_PIN_NOTICE,
  SEND_ME_A_TEST,
  TEST_SENT_TOAST,
  tokenSavedOn,
} from '../../copy/settings'
import { GENERIC_REFUSAL_MESSAGE } from '../../copy/common'


export interface PinnedCatalog {
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

interface IntegrationsFormProps {
  initial: PinnedCatalog
  /** Called after a successful Probarlo, the only save. */
  onSaved?: () => void
  /** Called whenever "something typed and not saved" changes. */
  onDirtyChange?: (dirty: boolean) => void
  /** The "Ir al catálogo" link: the group shows it, an Onboarding step does not. */
  showCatalogLink: boolean
}

export function IntegrationsForm({
  initial,
  onSaved,
  onDirtyChange,
  showCatalogLink,
}: IntegrationsFormProps) {
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

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

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

  async function onProbarlo(): Promise<void> {
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
      onSaved?.()
    } catch (caught) {
      // A refusal saves nothing and keeps everything typed, the token included.
      showRefusal(caught)
    } finally {
      setTesting(false)
      invalidateResource(queryClient, 'pinnedCatalog')
    }
  }

  // Probarlo is icon + text, so it is not a submit button: the form still submits on Enter
  // from a field, exactly as it did, through the same handler.
  function onFormSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
  }

  function onFormKeyDown(event: KeyboardEvent<HTMLFormElement>): void {
    if (event.key !== 'Enter' || !(event.target instanceof HTMLInputElement)) return
    event.preventDefault()
    if (!testing) void onProbarlo()
  }

  return (
    <>
      {toast !== null && <AvisoExito texto={toast} />}

      <form className="formulario" onSubmit={onFormSubmit} onKeyDown={onFormKeyDown}>
        {tokenFieldOpen ? (
          <label className="campo">
            <span className="campo__rotulo">{BOT_TOKEN_LABEL}</span>
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
              <span>{BOT_TOKEN_LABEL}</span>
              <span className="catalogo__fila-detalle">
                {tokenSavedOn(formatDate(accepted.tokenSavedOn as string))}
              </span>
            </span>
            <Boton variant="link" onClick={() => setTokenChanging(true)}>
              {CHANGE}
            </Boton>
          </div>
        )}

        <div className="campo">
          <label className="campo__rotulo" htmlFor={`${fieldId}-channel`}>
            {CHANNEL_CHAT_LABEL}
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
            {OWN_CHAT_LABEL}
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
            <Boton
              variant="secondary"
              icon="buscar"
              disabled={!canSearch || searching}
              ariaDescribedBy={canSearch ? undefined : `${fieldId}-search-help`}
              onClick={() => void onSearchOwnChat()}
            >
              {FIND_MY_CHAT}
            </Boton>
          </div>
          <div id={`${fieldId}-own-help`}>
            <MasInfo line={OWN_CHAT_INFO.line} more={OWN_CHAT_INFO.more} />
          </div>
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

        <Boton icon="probar" disabled={testing} onClick={() => void onProbarlo()}>
          {SEND_ME_A_TEST}
        </Boton>
      </form>

      {showCatalogLink && (
        <BotonLink to={CATALOG} variant="link">
          {GO_TO_CATALOG}
        </BotonLink>
      )}
    </>
  )
}

export default function IntegrationsGroup() {
  const [dirty, setDirty] = useState(false)
  const query = useQuery({
    queryKey: keys.pinnedCatalog(),
    queryFn: () => get<PinnedCatalog>('/pinned-catalog'),
  })

  if (query.data !== undefined) {
    return (
      <SettingsGroup title={GROUP_INTEGRATIONS} dirty={dirty} leave={LEAVE_CHANGE}>
        <IntegrationsForm initial={query.data} onDirtyChange={setDirty} showCatalogLink />
      </SettingsGroup>
    )
  }

  return (
    <SettingsGroup title={GROUP_INTEGRATIONS} dirty={false} leave={LEAVE_CHANGE}>
      {query.isPending && <Loading />}
      {query.isError ? query.error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico /> : null}
    </SettingsGroup>
  )
}
