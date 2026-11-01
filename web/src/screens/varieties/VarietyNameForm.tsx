/**
 * `VarietyNameForm`: the name field and its save (`POST /api/products`), taken out of
 * `VarietyNew` so the Onboarding's first step can reuse it. It knows nothing of the router:
 * its host decides what follows a save (`onSaved`, with the new variety's id and name) and
 * learns whether something was typed (`onDirtyChange`). A refusal shows under the name and
 * keeps what was typed. In a sheet (`sheet`) the connection notice and the save are the pinned
 * actions, the form's last child; elsewhere they render as they always did.
 */

import { type FormEvent, Fragment, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError, UNKNOWN_CODE, post } from '../../api/client'
import { invalidateResource, keys } from '../../api/keys'
import { listUnits } from '../../api/units'
import { kindOf, resolveOverride } from '../../api/refusals'
import { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import SinConexion from '../../components/SinConexion'
import Boton from '../../components/Boton'
import { SheetActions } from '../../components/Sheet'
import { GENERIC_REFUSAL_MESSAGE, type Variety } from '../Variedades'
import { VARIETY_NAME_HELP, VARIETIES_TEXT } from '../../copy/varieties'
import { SAVE_OVERRIDES } from './varietyForms'
import { COMMON_TEXT } from '../../copy/common'
import { useTranslation } from 'react-i18next'
import { messageText } from '../../i18n/refusalKeys'

export interface VarietyNameFormProps {
  onSaved: (saved: Pick<Variety, 'id' | 'name'>) => void
  onDirtyChange: (dirty: boolean) => void
  /** True when a `Sheet` draws the form: its connection notice and main action are the pinned actions. */
  sheet?: boolean
}

export default function VarietyNameForm({ onSaved, onDirtyChange, sheet = false }: VarietyNameFormProps) {
  const Actions = sheet ? SheetActions : Fragment
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [sending, setSending] = useState(false)
  const units = useQuery({ queryKey: keys.units(), queryFn: listUnits })
  const [chosen, setChosen] = useState('')
  const [unitError, setUnitError] = useState<string | null>(null)
  const unitList = units.data ?? []
  // One unit is preselected; with two or more the seller must choose.
  const unitId = unitList.length === 1 ? unitList[0]?.id : chosen === '' ? undefined : Number(chosen)

  const dirty = name !== ''
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)
    setUnitError(null)
    setOffline(false)
    if (unitId === undefined && unitList.length > 1) {
      setUnitError(t('units:errUnitRequired'))
      return
    }
    setSending(true)
    try {
      const saved = await post<Variety>('/api/products', { name, unit_id: unitId })
      invalidateResource(queryClient, 'varieties')
      onSaved({ id: saved.id, name: saved.name })
    } catch (caught) {
      if (caught instanceof ApiError) {
        const message = resolveOverride(SAVE_OVERRIDES, caught.code)
        if (caught.code === 'product.unit_required') setUnitError(t('units:errUnitRequired'))
        else if (message !== undefined) setError(messageText(t, message))
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
    <form className="formulario" onSubmit={onSubmit}>
      <label className="campo">
        <span className="campo__rotulo">{COMMON_TEXT.name}</span>
        <input
          className="campo__input"
          type="text"
          placeholder={VARIETIES_TEXT.nombreDeLaVariedad}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <span className="pie" data-copy="help">{VARIETY_NAME_HELP}</span>
        {error !== null && (
          <span className="campo__error" role="alert">
            {error}
          </span>
        )}
      </label>
      {unitList.length > 1 && (
        <label className="campo">
          <span className="campo__rotulo">{t('units:unitLabel')}</span>
          <select
            className="campo__input"
            value={chosen}
            aria-required
            onChange={(event) => {
              setChosen(event.target.value)
              setUnitError(null)
            }}
          >
            <option value="">{t('units:unitPlaceholder')}</option>
            {unitList.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
          {unitError !== null && (
            <span className="campo__error" role="alert">
              {unitError}
            </span>
          )}
        </label>
      )}
      <Actions>
        {offline && <SinConexion />}
        <Boton textOnly="submit" type="submit" disabled={sending}>
          {VARIETIES_TEXT.agregaLaVariedad}
        </Boton>
      </Actions>
    </form>
  )
}
