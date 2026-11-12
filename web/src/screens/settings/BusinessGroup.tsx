/**
 * The "Negocio" group of Configuración (`ConfiguracionNegocio.dc.html`; `accounts.md`):
 * renaming the business and choosing its Phone country, both under the form's one Save.
 *
 * The business comes only from the session: `GET`/`PATCH /business` never take an id
 * (CODING_STANDARDS §9). Saving shows the fixed toast "Saved" (a constant,
 * never built from the response). A rejected name (`account.business_name_invalid`) shows
 * inline and keeps what was typed, dispatched through `refusals.ts`. A dropped network shows
 * "Sin conexión", never the generic retry, which would wrongly blame the server.
 *
 * `dirty` is the typed name against `accepted`, or the chosen Phone country against the one the
 * server last accepted: both taken once from the first answer and reset from the save's answer.
 * They are never compared with the query cache, which the save refetches and a partner's change
 * can move under the form. The Phone country saves through `PUT /business/phone-country` and
 * shows what the API answered; its options are the API's, after "No country".
 */

import { type FormEvent, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError, UNKNOWN_CODE, get, patch, put } from '../../api/client'
import { type PhoneCountryOption, savePhoneCountry } from '../../api/phoneCountry'
import { invalidateResource, keys } from '../../api/keys'
import { type LanguageTag, type StoredLanguage, sameLanguage } from '../../api/language'
import { LANGUAGE_NOT_SELECTABLE_MESSAGE, kindOf, resolveOverride, type RefusalCode } from '../../api/refusals'
import AvisoExito from '../../components/AvisoExito'
import Boton from '../../components/Boton'
import Icono from '../../components/Icono'
import PhoneCountryControl from './PhoneCountryControl'
import InAppLink from '../../components/InAppLink'
import { SETTINGS_CURRENCY, SETTINGS_WITHDRAWAL_REASONS } from '../../routes'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import { LANGUAGES } from '../../components/fixedSets'
import SinConexion from '../../components/SinConexion'
import Loading from '../../components/Loading'
import {
  BUSINESS_NAME_INVALID_MESSAGE,
  GENERIC_REFUSAL_MESSAGE,
  RENAME_SUCCESS,
  SETTINGS_TEXT,
} from '../../copy/settings'
import SettingsGroup from './SettingsGroup'
import { COMMON_TEXT } from '../../copy/common'
import { useTranslation } from 'react-i18next'
import { refusalText, type Refusal } from '../../i18n/refusalKeys'

interface Business {
  name: string
  /** The stored language (never the shown one): what this control marks as current. */
  language: StoredLanguage
  selectable_languages: readonly LanguageTag[]
  /** The stored Phone country (an ISO code) or null, and the countries it may take, in order. */
  phone_country: string | null
  phone_countries: readonly PhoneCountryOption[]
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

const LANGUAGE_OVERRIDES: Partial<Record<RefusalCode, Refusal>> = {
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
  return (
    <BusinessForm
      initialName={data.name}
      initialPhoneCountry={data.phone_country}
      phoneCountries={data.phone_countries}
      language={data.language}
      selectable={data.selectable_languages}
    />
  )
}

interface BusinessFormProps {
  initialName: string
  initialPhoneCountry: string | null
  phoneCountries: readonly PhoneCountryOption[]
  language: StoredLanguage
  selectable: readonly LanguageTag[]
}

/** The message a failed save shows: the refusal's fixed words, the generic retry otherwise. */
function failureMessage(caught: ApiError, overrides: Partial<Record<RefusalCode, string>>): string {
  const message = resolveOverride(overrides, caught.code)
  if (message !== undefined) {
    return message
  }
  return caught.code !== UNKNOWN_CODE && kindOf(caught.code) === 'refusal'
    ? GENERIC_REFUSAL_MESSAGE
    : ERROR_GENERICO_MENSAJE
}

function BusinessForm({
  initialName,
  initialPhoneCountry,
  phoneCountries,
  language,
  selectable,
}: BusinessFormProps) {
  const queryClient = useQueryClient()
  const [accepted, setAccepted] = useState(initialName)
  const [name, setName] = useState(initialName)
  const [acceptedCountry, setAcceptedCountry] = useState(initialPhoneCountry)
  const [country, setCountry] = useState(initialPhoneCountry)
  const [nameError, setNameError] = useState<string | null>(null)
  const [countryError, setCountryError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function onNameChange(value: string): void {
    setName(value)
    setNameError(null)
    setOffline(false)
    setSaved(false)
  }

  function onCountryChange(value: string | null): void {
    setCountry(value)
    setCountryError(null)
    setOffline(false)
    setSaved(false)
  }

  async function onSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setNameError(null)
    setCountryError(null)
    setOffline(false)
    setSaved(false)
    setSaving(true)
    const countryChanged = country !== acceptedCountry
    try {
      // The name saves when it changed or when it is all that is saved (a blank one is refused).
      if (name !== accepted || !countryChanged) {
        try {
          const updated = await patch<Business>('/business', { name })
          setAccepted(updated.name)
          setName(updated.name)
          invalidateResource(queryClient, 'business')
        } catch (caught) {
          if (caught instanceof ApiError) {
            setNameError(failureMessage(caught, RENAME_OVERRIDES))
            return
          }
          throw caught
        }
      }
      if (countryChanged) {
        try {
          const answered = await savePhoneCountry(country)
          queryClient.setQueryData<Business>(keys.business(), (old) =>
            old === undefined
              ? old
              : { ...old, phone_country: answered.phone_country, phone_countries: answered.phone_countries },
          )
          setAcceptedCountry(answered.phone_country)
          setCountry(answered.phone_country)
          invalidateResource(queryClient, 'business')
        } catch (caught) {
          if (caught instanceof ApiError) {
            setCountryError(failureMessage(caught, {}))
            return
          }
          throw caught
        }
      }
      setSaved(true)
    } catch (caught) {
      if (caught instanceof NetworkError) {
        setOffline(true)
      } else {
        setNameError(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsGroup
      title={COMMON_TEXT.business}
      dirty={name !== accepted || country !== acceptedCountry}
      leave={LEAVE}
    >
      {saved && (
        <div className="aviso-flotante">
          <AvisoExito texto={RENAME_SUCCESS} />
        </div>
      )}
      <form className="formulario" onSubmit={onSave}>
        <label className="campo">
          <span className="campo__rotulo">{COMMON_TEXT.businessName}</span>
          <input
            className="campo__input"
            type="text"
            autoComplete="organization"
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
        <PhoneCountryControl
          options={phoneCountries}
          value={country}
          onChange={onCountryChange}
          error={countryError}
          disabled={saving}
        />
        <Boton textOnly="submit" type="submit" disabled={saving}>
          {COMMON_TEXT.save}
        </Boton>
        {offline && <SinConexion />}
      </form>
      {selectable.length > 1 && <LanguageControl language={language} selectable={selectable} />}
      <div className="ajustes__lista">
        <InAppLink to={SETTINGS_CURRENCY} className="ajustes__item">
          <span className="ajustes__item-icono">
            <Icono nombre="precio" />
          </span>
          <span className="ajustes__item-rotulo">{COMMON_TEXT.currencyAndDecimals}</span>
          <span className="ajustes__item-flecha">
            <Icono nombre="chevron" />
          </span>
        </InAppLink>
        <InAppLink to={SETTINGS_WITHDRAWAL_REASONS} className="ajustes__item">
          <span className="ajustes__item-icono">
            <Icono nombre="salidaStock" />
          </span>
          <span className="ajustes__item-rotulo">{COMMON_TEXT.withdrawalReasons}</span>
          <span className="ajustes__item-flecha">
            <Icono nombre="chevron" />
          </span>
        </InAppLink>
      </div>
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
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)

  const known = LANGUAGES.some((option) => sameLanguage(language, option.value))
  const selectableNow = selectable.includes(language)

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
        setMessage(refusal === undefined ? ERROR_GENERICO_MENSAJE : refusalText(t, refusal))
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
      {!known && <span className="campo__ayuda">{SETTINGS_TEXT.currentLanguage(language)}</span>}
      <div className="ajustes-tema" role="radiogroup" aria-label={SETTINGS_TEXT.languageGroupName}>
        {LANGUAGES.filter(
          (option) => selectable.includes(option.value) || (known && sameLanguage(language, option.value)),
        ).map((option) => {
          const checked = sameLanguage(language, option.value)
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={saving || (checked && !selectableNow)}
              className={checked ? 'ajustes-tema__opcion ajustes-tema__opcion--activa' : 'ajustes-tema__opcion'}
              onClick={() => {
                void choose(option.value)
              }}
            >
              {option.label()}
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

