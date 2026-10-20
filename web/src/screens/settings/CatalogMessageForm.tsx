/**
 * The catalog's header and footer form (`ConfiguracionMensaje.dc.html`,
 * `ConfiguracionMensajeCompu.dc.html`; `catalog.md`): two multi-line fields, up to 500
 * characters each (the backend counts; the inputs carry no `maxLength`), blank allowed. It is
 * the body of the "Mensaje del catálogo" group and of the Onboarding's catalog step; its host
 * draws the frame and the leave guard.
 *
 * Success shows the fixed toast "Catálogo guardado" and calls `onSaved`. A refusal shows
 * inline under its field and keeps what was typed; a dropped network shows "Sin conexión",
 * never the generic retry.
 *
 * `onDirtyChange` reports both fields against `accepted`: the pair the server last accepted,
 * taken once from the first read and reset from the PUT answer. It is never compared with the
 * query cache, which a save rewrites and a partner's edit can move under the form.
 *
 * The read shares the catalog screen's frozen query (`gcTime: 0`, `staleTime: Infinity`), so a
 * save's own answer replaces that key's data and nothing refetches behind the seller's back.
 */

import { type FormEvent, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogQueryOptions, writeCatalog, type Catalog } from '../../api/catalog'
import { ApiError, NetworkError, UNKNOWN_CODE, put } from '../../api/client'
import { kindOf, resolveOverride, type RefusalCode } from '../../api/refusals'
import AvisoExito from '../../components/AvisoExito'
import Boton from '../../components/Boton'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import SinConexion from '../../components/SinConexion'
import Loading from '../../components/Loading'
import {
  CATALOG_SAVED,
  FOOTER_TOO_LONG_MESSAGE,
  GENERIC_REFUSAL_MESSAGE,
  HEADER_TOO_LONG_MESSAGE, SETTINGS_TEXT,
} from '../../copy/settings'

const SUBMIT_LABEL = 'Guardá el mensaje'

interface HeaderFooter {
  header: string
  footer: string
}

type Field = 'header' | 'footer'

const OVERRIDES: Record<Field, Partial<Record<RefusalCode, string>>> = {
  header: { 'catalog.header_too_long': HEADER_TOO_LONG_MESSAGE },
  footer: { 'catalog.footer_too_long': FOOTER_TOO_LONG_MESSAGE },
}

export interface CatalogMessageFormProps {
  onSaved?: () => void
  onDirtyChange: (dirty: boolean) => void
  /** The submit's word; the Onboarding's step 3 says "Guardar". */
  submitLabel?: string
}

export default function CatalogMessageForm({ onSaved, onDirtyChange, submitLabel }: CatalogMessageFormProps) {
  const { data, isPending, isError, error } = useQuery(catalogQueryOptions())

  if (isPending) return <Loading />
  if (isError) return error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />
  return (
    <MessageForm
      initial={{ header: data.header, footer: data.footer }}
      onSaved={onSaved}
      onDirtyChange={onDirtyChange}
      submitLabel={submitLabel}
    />
  )
}

interface MessageFormProps extends CatalogMessageFormProps {
  initial: HeaderFooter
}

function MessageForm({ initial, onSaved, onDirtyChange, submitLabel = SUBMIT_LABEL }: MessageFormProps) {
  const queryClient = useQueryClient()
  const [accepted, setAccepted] = useState(initial)
  const [header, setHeader] = useState(initial.header)
  const [footer, setFooter] = useState(initial.footer)
  const [fieldError, setFieldError] = useState<{ field: Field; message: string } | null>(null)
  const [genericError, setGenericError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const dirty = header !== accepted.header || footer !== accepted.footer
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  function clearFeedback(): void {
    setFieldError(null)
    setGenericError(null)
    setOffline(false)
    setSaved(false)
  }

  function refuse(code: string): void {
    for (const field of ['header', 'footer'] as const) {
      const message = resolveOverride(OVERRIDES[field], code)
      if (message !== undefined) {
        setFieldError({ field, message })
        return
      }
    }
    setGenericError(
      code !== UNKNOWN_CODE && kindOf(code) === 'refusal'
        ? GENERIC_REFUSAL_MESSAGE
        : ERROR_GENERICO_MENSAJE,
    )
  }

  async function onSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    clearFeedback()
    setSaving(true)
    try {
      const view = await put<Catalog>('/catalog/header-footer', { header, footer })
      writeCatalog(queryClient, view)
      setAccepted({ header: view.header, footer: view.footer })
      setHeader(view.header)
      setFooter(view.footer)
      setSaved(true)
      onSaved?.()
    } catch (caught) {
      if (caught instanceof NetworkError) setOffline(true)
      else if (caught instanceof ApiError) refuse(caught.code)
      else setGenericError(ERROR_GENERICO_MENSAJE)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {saved && (
        <div className="aviso-flotante">
          <AvisoExito texto={CATALOG_SAVED} />
        </div>
      )}
      <form className="formulario" onSubmit={onSave}>
        <div className="campo">
          <label className="campo__rotulo" htmlFor="catalog-header">
            {SETTINGS_TEXT.encabezado}
          </label>
          <textarea
            id="catalog-header"
            className="campo__input"
            aria-describedby={fieldError?.field === 'header' ? 'catalog-header-error' : undefined}
            value={header}
            onChange={(event) => {
              setHeader(event.target.value)
              clearFeedback()
            }}
          />
          {fieldError?.field === 'header' && (
            <span id="catalog-header-error" className="campo__error" role="alert">
              {fieldError.message}
            </span>
          )}
        </div>
        <div className="campo">
          <label className="campo__rotulo" htmlFor="catalog-footer">
            {SETTINGS_TEXT.pie}
          </label>
          <textarea
            id="catalog-footer"
            className="campo__input"
            aria-describedby={fieldError?.field === 'footer' ? 'catalog-footer-error' : undefined}
            value={footer}
            onChange={(event) => {
              setFooter(event.target.value)
              clearFeedback()
            }}
          />
          {fieldError?.field === 'footer' && (
            <span id="catalog-footer-error" className="campo__error" role="alert">
              {fieldError.message}
            </span>
          )}
        </div>
        {genericError !== null && (
          <span className="campo__error" role="alert">
            {genericError}
          </span>
        )}
        {offline && <SinConexion />}
        <Boton textOnly="submit" type="submit" disabled={saving}>
          {submitLabel}
        </Boton>
      </form>
    </>
  )
}
