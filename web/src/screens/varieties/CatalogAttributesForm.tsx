/**
 * `CatalogAttributesForm`: edits how one variety shows in the catalog (`PUT
 * /catalog/varieties/{id}`: shown or not, emoji, % índica, aroma/sabor), opened over its
 * page. It is the only place these attributes are edited. Like `RenameForm` it knows
 * nothing of the router: its host supplies the exits and learns whether something was
 * typed. Each refusal shows under its own field (`fieldOfRefusal`) and keeps everything
 * typed. Only the shape of the % índica text is checked here (whole digits, so it can be
 * the integer the API takes); its 0 to 100 range, the emoji and the aroma length are the
 * domain's rules, answered by the server.
 */

import { type FormEvent, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { CatalogVariety } from '../../api/catalog'
import { ApiError, NetworkError, UNKNOWN_CODE, put } from '../../api/client'
import { invalidateResource } from '../../api/keys'
import { isGone, kindOf } from '../../api/refusals'
import type { SuccessToast } from '../../components/AvisoExito'
import { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import SinConexion from '../../components/SinConexion'
import { GENERIC_REFUSAL_MESSAGE } from '../Variedades'
import { INDICA_SHARE_INVALID_MESSAGE, fieldOfRefusal, type CatalogField } from './catalogFormErrors'
import Boton from '../../components/Boton'

export const CATALOG_ATTRIBUTES_SAVED: SuccessToast = 'Catálogo guardado'

export interface CatalogAttributesFormProps {
  row: Pick<CatalogVariety, 'id' | 'shown' | 'emoji' | 'indica_share' | 'aroma'>
  onDone: (saved: SuccessToast) => void
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
  onGone: () => void
}

interface Typed {
  shown: boolean
  emoji: string
  indica: string
  aroma: string
}

function typedFrom(row: CatalogAttributesFormProps['row']): Typed {
  return {
    shown: row.shown,
    emoji: row.emoji ?? '',
    indica: row.indica_share === null ? '' : String(row.indica_share),
    aroma: row.aroma ?? '',
  }
}

function nullIfEmpty(text: string): string | null {
  return text.trim() === '' ? null : text
}

export default function CatalogAttributesForm({ row, onDone, onCancel, onDirtyChange, onGone }: CatalogAttributesFormProps) {
  const queryClient = useQueryClient()
  const saved = typedFrom(row)
  const [typed, setTyped] = useState<Typed>(saved)
  const [fieldError, setFieldError] = useState<{ field: CatalogField; message: string } | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [sending, setSending] = useState(false)

  const dirty =
    typed.shown !== saved.shown || typed.emoji !== saved.emoji || typed.indica !== saved.indica || typed.aroma !== saved.aroma
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  function errorUnder(field: CatalogField) {
    return fieldError !== null && fieldError.field === field ? (
      <span className="campo__error" role="alert">
        {fieldError.message}
      </span>
    ) : null
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setFieldError(null)
    setGeneralError(null)
    setOffline(false)
    const indica = typed.indica.trim()
    if (indica !== '' && !/^\d+$/.test(indica)) {
      setFieldError({ field: 'indica_share', message: INDICA_SHARE_INVALID_MESSAGE })
      return
    }
    setSending(true)
    try {
      await put(`/catalog/varieties/${row.id}`, {
        shown: typed.shown,
        emoji: nullIfEmpty(typed.emoji)?.trim() ?? null,
        indica_share: indica === '' ? null : Number(indica),
        aroma: nullIfEmpty(typed.aroma),
      })
      invalidateResource(queryClient, 'catalog')
      onDone(CATALOG_ATTRIBUTES_SAVED)
    } catch (caught) {
      if (caught instanceof ApiError && isGone(caught.code)) {
        invalidateResource(queryClient, 'catalog')
        onGone()
      } else if (caught instanceof ApiError) {
        const field = fieldOfRefusal(caught.code)
        if (field !== null) setFieldError(field)
        else if (caught.code !== UNKNOWN_CODE && kindOf(caught.code) === 'refusal') setGeneralError(GENERIC_REFUSAL_MESSAGE)
        else setGeneralError(ERROR_GENERICO_MENSAJE)
      } else if (caught instanceof NetworkError) {
        setOffline(true)
      } else {
        setGeneralError(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="gasto-form">
      <div className="gasto-form__cabecera">
        <span className="gasto-form__titulo">En el catálogo</span>
        <span className="gasto-form__cerrar">
          <Boton variant="link" onClick={onCancel}>
            Cerrar
          </Boton>
        </span>
      </div>
      <form className="formulario" onSubmit={onSubmit}>
        <div className="seccion-variedad__fila">
          <span className="campo__rotulo">Mostrar en el catálogo</span>
          <button
            type="button"
            role="switch"
            aria-checked={typed.shown}
            aria-label="Mostrar en el catálogo"
            className="interruptor"
            onClick={() => setTyped({ ...typed, shown: !typed.shown })}
          >
            <span className="interruptor__perilla" aria-hidden="true" />
          </button>
        </div>
        <label className="campo">
          <span className="campo__rotulo">Emoji</span>
          <input
            className="campo__input"
            type="text"
            value={typed.emoji}
            onChange={(event) => setTyped({ ...typed, emoji: event.target.value })}
          />
          {errorUnder('emoji')}
        </label>
        <label className="campo">
          <span className="campo__rotulo">% índica</span>
          <input
            className="campo__input"
            type="text"
            inputMode="numeric"
            value={typed.indica}
            onChange={(event) => setTyped({ ...typed, indica: event.target.value })}
          />
          {errorUnder('indica_share')}
        </label>
        <label className="campo">
          <span className="campo__rotulo">Aroma/sabor</span>
          <input
            className="campo__input"
            type="text"
            value={typed.aroma}
            onChange={(event) => setTyped({ ...typed, aroma: event.target.value })}
          />
          {errorUnder('aroma')}
        </label>
        {generalError !== null && (
          <span className="campo__error" role="alert">
            {generalError}
          </span>
        )}
        {offline && <SinConexion />}
        <Boton textOnly="submit" type="submit" disabled={sending}>
          Guardá el catálogo
        </Boton>
      </form>
    </div>
  )
}
