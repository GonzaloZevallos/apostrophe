/**
 * The "Mensaje del catálogo" group of Configuración (`ConfiguracionMensaje.dc.html`,
 * `ConfiguracionMensajeCompu.dc.html`; `catalog.md`): the catalog's header and footer, two
 * multi-line fields, up to 500 characters each (the backend counts; the inputs carry no
 * `maxLength`), blank allowed.
 *
 * Success shows the fixed toast "Catálogo guardado". A refusal shows inline under its field
 * and keeps what was typed; a dropped network shows "Sin conexión", never the generic retry.
 *
 * `dirty` is both fields against `accepted`: the pair the server last accepted, taken once
 * from the first read and reset from the PUT answer. It is never compared with the query
 * cache, which a save rewrites and a partner's edit can move under the form.
 *
 * The read shares the catalog screen's frozen query (`gcTime: 0`, `staleTime: Infinity`), so a
 * save's own answer replaces that key's data and nothing refetches behind the seller's back.
 */

import { type FormEvent, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError, UNKNOWN_CODE, get, put } from '../../api/client'
import { keys } from '../../api/keys'
import { kindOf, resolveOverride, type RefusalCode } from '../../api/refusals'
import AvisoExito from '../../components/AvisoExito'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import SinConexion from '../../components/SinConexion'
import Loading from '../../components/Loading'
import {
  CATALOG_SAVED,
  FOOTER_TOO_LONG_MESSAGE,
  GENERIC_REFUSAL_MESSAGE,
  HEADER_TOO_LONG_MESSAGE,
} from './messages'
import SettingsGroup from './SettingsGroup'

interface HeaderFooter {
  header: string
  footer: string
}

const TITLE = 'Mensaje del catálogo'

const LEAVE = {
  question: '¿Descartás el mensaje?',
  detail: 'Se pierde lo que cargaste: todavía no se guardó nada.',
  keepLabel: 'No, seguí editando',
  discardLabel: 'Sí, descartalo',
}

type Field = 'header' | 'footer'

const OVERRIDES: Record<Field, Partial<Record<RefusalCode, string>>> = {
  header: { 'catalog.header_too_long': HEADER_TOO_LONG_MESSAGE },
  footer: { 'catalog.footer_too_long': FOOTER_TOO_LONG_MESSAGE },
}

export default function CatalogMessageGroup() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: keys.catalog(),
    queryFn: () => get<HeaderFooter>('/catalog'),
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  if (isPending || isError) {
    return (
      <SettingsGroup title={TITLE} dirty={false} leave={LEAVE}>
        {isPending && <Loading />}
        {isError && (error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />)}
      </SettingsGroup>
    )
  }
  return <MessageForm initial={{ header: data.header, footer: data.footer }} />
}

function MessageForm({ initial }: { initial: HeaderFooter }) {
  const queryClient = useQueryClient()
  const [accepted, setAccepted] = useState(initial)
  const [header, setHeader] = useState(initial.header)
  const [footer, setFooter] = useState(initial.footer)
  const [fieldError, setFieldError] = useState<{ field: Field; message: string } | null>(null)
  const [genericError, setGenericError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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
      const view = await put<HeaderFooter>('/catalog/header-footer', { header, footer })
      queryClient.setQueryData(keys.catalog(), view)
      setAccepted({ header: view.header, footer: view.footer })
      setHeader(view.header)
      setFooter(view.footer)
      setSaved(true)
    } catch (caught) {
      if (caught instanceof NetworkError) setOffline(true)
      else if (caught instanceof ApiError) refuse(caught.code)
      else setGenericError(ERROR_GENERICO_MENSAJE)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsGroup
      title={TITLE}
      dirty={header !== accepted.header || footer !== accepted.footer}
      leave={LEAVE}
    >
      {saved && (
        <div className="aviso-flotante">
          <AvisoExito texto={CATALOG_SAVED} />
        </div>
      )}
      <form className="formulario" onSubmit={onSave}>
        <div className="campo">
          <label className="campo__rotulo" htmlFor="catalog-header">
            Encabezado
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
            Pie
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
        <button className="boton" type="submit" disabled={saving}>
          Guardá el mensaje
        </button>
      </form>
    </SettingsGroup>
  )
}
