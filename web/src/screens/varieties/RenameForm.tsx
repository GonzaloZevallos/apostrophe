/**
 * `RenameForm`: renames a variety (`PATCH /api/products/{id}`). Like `ExpenseForm` it knows
 * nothing of the router: its host supplies the exits (`onDone`, `onCancel`) and learns
 * whether something was typed (`onDirtyChange`), so the host alone decides how leaving
 * works. A refusal shows under the name and keeps what was typed.
 */

import { type FormEvent, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError, UNKNOWN_CODE, patch } from '../../api/client'
import { invalidateResource } from '../../api/keys'
import {
  NAME_ARCHIVED_MESSAGE,
  isGone,
  kindOf,
  resolveOverride,
  type RefusalCode,
} from '../../api/refusals'
import type { SuccessToast } from '../../components/AvisoExito'
import { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import SinConexion from '../../components/SinConexion'
import Boton from '../../components/Boton'
import { SheetActions } from '../../components/Sheet'
import {
  GENERIC_REFUSAL_MESSAGE,
  NAME_INVALID_MESSAGE,
  NAME_TAKEN_MESSAGE,
  VARIETY_SAVED,
  type Variety,
} from '../Variedades'
import { VARIETIES_TEXT } from '../../copy/varieties'
import { COMMON_TEXT } from '../../copy/common'
import { useTranslation } from 'react-i18next'
import { messageText, type Refusal } from '../../i18n/refusalKeys'

const RENAME_OVERRIDES: Partial<Record<RefusalCode, Refusal | string>> = {
  'variety.name_taken': NAME_TAKEN_MESSAGE,
  'variety.name_archived': NAME_ARCHIVED_MESSAGE,
  'variety.name_invalid': NAME_INVALID_MESSAGE,
}

export interface RenameFormProps {
  variety: Pick<Variety, 'id' | 'name'>
  onDone: (saved: SuccessToast) => void
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
  onGone: () => void
}

export default function RenameForm({ variety, onDone, onCancel, onDirtyChange, onGone }: RenameFormProps) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const [name, setName] = useState(variety.name)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [sending, setSending] = useState(false)

  const dirty = name !== variety.name
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)
    setOffline(false)
    setSending(true)
    try {
      await patch<Variety>(`/api/products/${variety.id}`, { name })
      invalidateResource(queryClient, 'varieties')
      onDone(VARIETY_SAVED)
    } catch (caught) {
      if (caught instanceof ApiError && isGone(caught.code)) {
        invalidateResource(queryClient, 'varieties')
        onGone()
      } else if (caught instanceof ApiError) {
        const message = resolveOverride(RENAME_OVERRIDES, caught.code)
        if (message !== undefined) setError(messageText(t, message))
        else if (caught.code !== UNKNOWN_CODE && kindOf(caught.code) === 'refusal') setError(GENERIC_REFUSAL_MESSAGE)
        else setError(ERROR_GENERICO_MENSAJE)
      } else if (caught instanceof NetworkError) {
        setOffline(true)
      } else {
        setError(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="gasto-form">
      <div className="gasto-form__cabecera">
        <span className="gasto-form__titulo">{VARIETIES_TEXT.renombrarVariedad}</span>
        <span className="gasto-form__cerrar">
          <Boton variant="icon" action="close" ariaLabel={COMMON_TEXT.close} onClick={onCancel} />
        </span>
      </div>
      <form className="formulario" onSubmit={onSubmit}>
        <label className="campo">
          <span className="campo__rotulo">{COMMON_TEXT.name}</span>
          <input
            className="campo__input"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          {error !== null && (
            <span className="campo__error" role="alert">
              {error}
            </span>
          )}
        </label>
        <SheetActions>
          {offline && <SinConexion />}
          <Boton textOnly="submit" type="submit" disabled={sending}>
            {COMMON_TEXT.saveTheName}
          </Boton>
        </SheetActions>
      </form>
    </div>
  )
}
