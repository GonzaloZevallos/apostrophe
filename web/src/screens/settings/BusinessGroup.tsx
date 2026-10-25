/**
 * The "Negocio" group of Configuración (`ConfiguracionNegocio.dc.html`; `accounts.md`):
 * renaming the business.
 *
 * The business comes only from the session: `GET`/`PATCH /business` never take an id
 * (CODING_STANDARDS §9). Renaming shows the fixed toast "Business renamed" (a constant,
 * never built from the response). A rejected name (`account.business_name_invalid`) shows
 * inline and keeps what was typed, dispatched through `refusals.ts`. A dropped network shows
 * "Sin conexión", never the generic retry, which would wrongly blame the server.
 *
 * `dirty` is the typed name against `accepted`: the name the server last accepted, taken
 * once from the first answer and reset from the PATCH answer. It is never compared with the
 * query cache, which the save refetches and a partner's rename can move under the form.
 */

import { type FormEvent, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError, UNKNOWN_CODE, get, patch, put } from '../../api/client'
import { invalidateResource, keys } from '../../api/keys'
import { type LanguageTag, type StoredLanguage, sameLanguage } from '../../api/language'
import { LANGUAGE_NOT_SELECTABLE_MESSAGE, kindOf, resolveOverride, type RefusalCode } from '../../api/refusals'
import AvisoExito from '../../components/AvisoExito'
import Boton from '../../components/Boton'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import SinConexion from '../../components/SinConexion'
import Loading from '../../components/Loading'
import {
  BUSINESS_NAME_INVALID_MESSAGE,
  GENERIC_REFUSAL_MESSAGE,
  RENAME_SUCCESS,
  SETTINGS_TEXT,
  languageName,
} from '../../copy/settings'
import SettingsGroup from './SettingsGroup'
import { COMMON_TEXT } from '../../copy/common'

interface Business {
  name: string
  /** The stored language (never the shown one): what this control marks as current. */
  language: StoredLanguage
  selectable_languages: readonly LanguageTag[]
}

/** What `PUT /business/language` answers. */
interface BusinessLanguage {
  language: StoredLanguage
  selectable_languages: readonly LanguageTag[]
}

const LEAVE = {
  question: SETTINGS_TEXT.discardTheName,
  detail: COMMON_TEXT.losesWhatYouEntered,
  keepLabel: COMMON_TEXT.noKeepEditing,
  discardLabel: COMMON_TEXT.yesDiscard,
}

const LANGUAGE_OVERRIDES: Partial<Record<RefusalCode, string>> = {
  'business.language_not_selectable': LANGUAGE_NOT_SELECTABLE_MESSAGE,
}

const RENAME_OVERRIDES: Partial<Record<RefusalCode, string>> = {
  'account.business_name_invalid': BUSINESS_NAME_INVALID_MESSAGE,
}

export default function BusinessGroup() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: keys.business(),
    queryFn: () => get<Business>('/business'),
  })

  if (isPending || isError) {
    return (
      <SettingsGroup title={COMMON_TEXT.business} dirty={false} leave={LEAVE}>
        {isPending && <Loading />}
        {isError && (error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />)}
      </SettingsGroup>
    )
  }
  return <BusinessForm initialName={data.name} language={data.language} selectable={data.selectable_languages} />
}

interface BusinessFormProps {
  initialName: string
  language: StoredLanguage
  selectable: readonly LanguageTag[]
}

function BusinessForm({ initialName, language, selectable }: BusinessFormProps) {
  const queryClient = useQueryClient()
  const [accepted, setAccepted] = useState(initialName)
  const [name, setName] = useState(initialName)
  const [nameError, setNameError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [saving, setSaving] = useState(false)
  const [renamed, setRenamed] = useState(false)

  function onNameChange(value: string): void {
    setName(value)
    setNameError(null)
    setOffline(false)
    setRenamed(false)
  }

  async function onRename(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setNameError(null)
    setOffline(false)
    setRenamed(false)
    setSaving(true)
    try {
      const updated = await patch<Business>('/business', { name })
      invalidateResource(queryClient, 'business')
      setAccepted(updated.name)
      setName(updated.name)
      setRenamed(true)
    } catch (caught) {
      if (caught instanceof NetworkError) {
        setOffline(true)
      } else if (caught instanceof ApiError) {
        const message = resolveOverride(RENAME_OVERRIDES, caught.code)
        if (message !== undefined) {
          setNameError(message)
        } else if (caught.code !== UNKNOWN_CODE && kindOf(caught.code) === 'refusal') {
          setNameError(GENERIC_REFUSAL_MESSAGE)
        } else {
          setNameError(ERROR_GENERICO_MENSAJE)
        }
      } else {
        setNameError(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsGroup title={COMMON_TEXT.business} dirty={name !== accepted} leave={LEAVE}>
      {renamed && (
        <div className="aviso-flotante">
          <AvisoExito texto={RENAME_SUCCESS} />
        </div>
      )}
      <form className="formulario" onSubmit={onRename}>
        <label className="campo">
          <span className="campo__rotulo">{COMMON_TEXT.businessName}</span>
          <input
            className="campo__input"
            type="text"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            required
          />
          {nameError !== null && (
            <span className="campo__error" role="alert">
              {nameError}
            </span>
          )}
        </label>
        <Boton textOnly="submit" type="submit" disabled={saving}>
          {COMMON_TEXT.saveTheName}
        </Boton>
        {offline && <SinConexion />}
      </form>
      {selectable.length > 1 && <LanguageControl language={language} selectable={selectable} />}
    </SettingsGroup>
  )
}

/**
 * The language control: a single-choice group that saves at once, with no Save step. It reads
 * and shows the **stored** language, never the shown one (invariant 8), straight from the
 * `GET /business` answer, so a refusal's reload is what corrects it. A stored language that is
 * off the selectable list is one extra selected segment, first, that cannot be tapped.
 */
function LanguageControl({ language, selectable }: { language: StoredLanguage; selectable: readonly LanguageTag[] }) {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)

  const offList = !selectable.some((tag) => sameLanguage(language, tag))
  const segments: readonly LanguageTag[] = offList ? [language, ...selectable] : selectable

  async function choose(tag: LanguageTag): Promise<void> {
    if (saving || sameLanguage(language, tag)) {
      return
    }
    setMessage(null)
    setOffline(false)
    setSaving(true)
    try {
      const answered = await put<BusinessLanguage>('/business/language', { language: tag })
      queryClient.setQueryData<Business>(keys.business(), (old) =>
        old === undefined
          ? old
          : { ...old, language: answered.language, selectable_languages: answered.selectable_languages },
      )
      void queryClient.invalidateQueries({ queryKey: keys.me() })
    } catch (caught) {
      if (caught instanceof NetworkError) {
        setOffline(true)
      } else if (caught instanceof ApiError) {
        const refusal = resolveOverride(LANGUAGE_OVERRIDES, caught.code)
        setMessage(refusal ?? ERROR_GENERICO_MENSAJE)
        if (refusal !== undefined) {
          invalidateResource(queryClient, 'business')
        }
      } else {
        setMessage(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ajustes-idioma">
      <span className="rotulo ajustes-tema__rotulo">{SETTINGS_TEXT.language}</span>
      <div className="ajustes-tema" role="radiogroup" aria-label={SETTINGS_TEXT.languageGroupName}>
        {segments.map((tag) => {
          const checked = sameLanguage(language, tag)
          const untappable = offList && checked
          return (
            <button
              key={tag}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={saving || untappable}
              className={checked ? 'ajustes-tema__opcion ajustes-tema__opcion--activa' : 'ajustes-tema__opcion'}
              onClick={() => {
                void choose(tag)
              }}
            >
              {languageName(tag)}
            </button>
          )
        })}
      </div>
      {message !== null && (
        <span className="campo__error" role="alert">
          {message}
        </span>
      )}
      {offline && <SinConexion />}
    </div>
  )
}
