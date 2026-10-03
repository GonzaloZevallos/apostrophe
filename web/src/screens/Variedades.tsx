/**
 * `Variedades` (`varieties.md`, "On screen"): today's list and bulk prices per
 * variety, "Sin precio: no se puede vender" when none is in force, and adding a
 * variety. A row links to `VariedadDetalle` by id alone — never a business id (plan,
 * invariants). Refusals are dispatched through `refusals.ts`, never a raw
 * `caught.code === '…'` comparison.
 */

import { type FormEvent, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useOutletContext } from 'react-router'
import { ApiError, NetworkError, UNKNOWN_CODE, get, post } from '../api/client'
import { invalidateResource, keys } from '../api/keys'
import type { Me } from '../api/me'
import { kindOf, resolveOverride, type RefusalCode } from '../api/refusals'
import AvisoExito, { type SuccessToast } from '../components/AvisoExito'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../components/ErrorGenerico'
import SinConexion from '../components/SinConexion'
import { formatGrams, formatMoney } from '../format/money'

export const VARIETY_SAVED = 'Variedad guardada'
export const NO_PRICE_TODAY = 'Sin precio: no se puede vender'
export const NAME_TAKEN_MESSAGE = 'Ya existe una variedad con ese nombre'
export const NAME_INVALID_MESSAGE = 'Ponele un nombre a la variedad, sin espacios de más'
export const GENERIC_REFUSAL_MESSAGE = 'Revisá los datos e intentá de nuevo.'

interface PriceEntry {
  id: number
  effective_from: string
  list_price: number
  bulk_price: number | null
  bulk_minimum: number | null
}

export interface Variety {
  id: number
  name: string
  current_price: PriceEntry | null
}

const SAVE_OVERRIDES: Partial<Record<RefusalCode, string>> = {
  'variety.name_taken': NAME_TAKEN_MESSAGE,
  'variety.name_invalid': NAME_INVALID_MESSAGE,
}

export default function Variedades() {
  useOutletContext<Me>()
  const queryClient = useQueryClient()
  const { data, isError, error } = useQuery({
    queryKey: keys.varieties(),
    queryFn: () => get<Variety[]>('/varieties'),
  })
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<SuccessToast | null>(null)

  useEffect(() => {
    if (toast === null) return
    const timer = setTimeout(() => {
      setToast(null)
    }, 3000)
    return () => clearTimeout(timer)
  }, [toast])

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setFormError(null)
    setOffline(false)
    setSending(true)
    try {
      await post<Variety>('/varieties', { name })
      invalidateResource(queryClient, 'varieties')
      setName('')
      setAdding(false)
      setToast(VARIETY_SAVED)
    } catch (caught) {
      if (caught instanceof ApiError) {
        const message = resolveOverride(SAVE_OVERRIDES, caught.code)
        if (message !== undefined) setFormError(message)
        else if (caught.code !== UNKNOWN_CODE && kindOf(caught.code) === 'refusal') {
          setFormError(GENERIC_REFUSAL_MESSAGE)
        } else {
          setFormError(ERROR_GENERICO_MENSAJE)
        }
      } else if (caught instanceof NetworkError) {
        setOffline(true)
      } else {
        setFormError(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setSending(false)
    }
  }

  if (isError) {
    if (error instanceof NetworkError) {
      return (
        <main className="pantalla">
          <div className="cuerpo">
            <SinConexion />
          </div>
        </main>
      )
    }
    return (
      <main className="pantalla">
        <div className="cuerpo">
          <ErrorGenerico />
        </div>
      </main>
    )
  }

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div className="encabezado-fila">
          <span className="encabezado__titulo">Variedades</span>
          <button
            type="button"
            className="boton-icono"
            aria-label="Nueva variedad"
            onClick={() => {
              setAdding(true)
              setFormError(null)
            }}
          >
            +
          </button>
        </div>
        {toast !== null && <AvisoExito texto={toast} />}
        {adding && (
          <form className="formulario" onSubmit={onSubmit}>
            <label className="campo">
              <span className="campo__rotulo">Nombre</span>
              <input
                className="campo__input"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
              {formError !== null && (
                <span className="campo__error" role="alert">
                  {formError}
                </span>
              )}
            </label>
            {offline && <SinConexion />}
            <button className="boton" type="submit" disabled={sending}>
              Guardar
            </button>
          </form>
        )}
        <div className="lista-variedades">
          {(data ?? []).map((variety) => (
            <Link key={variety.id} to={`/variedades/${variety.id}`} className="variedad-item">
              <span className="variedad-item__nombre">{variety.name}</span>
              {variety.current_price === null ? (
                <span className="variedad-item__sin-precio">{NO_PRICE_TODAY}</span>
              ) : (
                <div className="variedad-item__precios">
                  <span className="precio-panel">
                    <span className="precio-panel__rotulo">Lista</span>
                    <span className="precio-panel__valor">
                      {formatMoney(variety.current_price.list_price)}
                    </span>
                  </span>
                  {variety.current_price.bulk_price !== null &&
                    variety.current_price.bulk_minimum !== null && (
                      <span className="precio-panel">
                        <span className="precio-panel__rotulo">
                          Desde {formatGrams(variety.current_price.bulk_minimum)}
                        </span>
                        <span className="precio-panel__valor">
                          {formatMoney(variety.current_price.bulk_price)}
                        </span>
                      </span>
                    )}
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
