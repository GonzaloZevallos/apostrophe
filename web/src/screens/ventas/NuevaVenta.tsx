/**
 * `NuevaVenta`/`NuevaVentaCompu` (`sales.md`, "On screen: Nueva venta"): loading a
 * sale in the middle of a chat — date, customer, one or more lines, shipping, a
 * note and how it was paid, each line priced live from `sales/pricing.ts` (plan,
 * invariants: the preview computes line totals and special-price rates only there).
 * What the screen shows after saving is what the API answered, never the preview
 * (invariants) — this screen only navigates to the new sale's detail, with the
 * "Venta guardada" notice as history state; `VentaDetalle` (`sales-list-and-detail`)
 * owns rendering that notice and its Deshacer.
 *
 * Prices (`GET /varieties?on=`) and, when opened via "Nueva venta a <name>", the
 * chosen customer, are fetched under the frozen `sale-form` keys
 * (`api/keys.ts`): `gcTime: 0`, `staleTime: Infinity`, no refetch on focus,
 * reconnect or an interval (plan, invariants) — every mount and every date change
 * fetches fresh, and nothing an earlier mount or another screen cached ever
 * surfaces here. The one other refetch is on `sale.no_price_that_day`.
 *
 * The leave guard (`useBlocker`, invariants: "reading a ref at call time") only
 * blocks Back/close once something has been typed, and never blocks the
 * replace-navigation a successful save performs — `savedRef` short-circuits the
 * blocker's predicate once `onSubmit` has already saved.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker, useLocation, useNavigate, useOutletContext } from 'react-router'
import { ApiError, NetworkError, UNKNOWN_CODE, get, post } from '../../api/client'
import type { Customer } from '../../api/customers'
import { keys } from '../../api/keys'
import type { Me } from '../../api/me'
import { resolveOverride, type RefusalCode } from '../../api/refusals'
import ConfirmDialog from '../../components/ConfirmDialog'
import { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import { readNewSaleState, saleJustSaved } from '../../components/feedback'
import SinConexion from '../../components/SinConexion'
import { formatDateLong, formatDateShort, maxSaleDate } from '../../format/dates'
import { formatGrams, formatMoney } from '../../format/money'
import { parseGrams, parseMoney } from '../../format/parse'
import {
  type LineValidation,
  type PaymentChoice,
  type PriceQuote,
  type PricingRule,
  fromHundredths,
  hundredthsOfApiGrams,
  priceLine,
  saleTotals,
  toHundredths,
  validateSale,
} from '../../sales/pricing'
import type { Variety } from '../Variedades'
import NuevaVentaCliente from './NuevaVentaCliente'

export const GENERIC_REFUSAL = 'Revisá los datos e intentá de nuevo.'
export const NO_LINES_MESSAGE = 'Cargá al menos una variedad.'
export const OWING_HINT = 'Para dejar debiendo elegí un cliente'
export const PAYMENT_REQUIRED_MESSAGE = 'Elegí cómo se pagó, o dejá la venta debiendo'
export const SPECIAL_PRICE_INVALID_MESSAGE = 'El precio especial tiene que ser mayor a $0'

const RULE_LABEL: Record<PricingRule, string> = {
  list: 'Lista',
  bulk: 'Por cantidad',
  vip: 'VIP',
  gift: 'Regalo',
  special: 'Especial',
}

interface LineState {
  key: string
  varietyId: string
  grams: string
  gift: boolean
  specialPrice: string
}

function emptyLine(): LineState {
  return {
    key: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    varietyId: '',
    grams: '',
    gift: false,
    specialPrice: '',
  }
}

function quoteOf(variety: Variety): PriceQuote | null {
  const price = variety.current_price
  if (price === null) return null
  const bulk =
    price.bulk_price !== null && price.bulk_minimum !== null
      ? { price: price.bulk_price, minimumHundredths: hundredthsOfApiGrams(price.bulk_minimum) }
      : null
  return { listPrice: price.list_price, bulk }
}

/** Whole pesos, zero or more — unlike `parseMoney` (money.ts), which rejects zero:
 * shipping charged is `$0` by default and that is a valid value to save with. */
function parseShipping(input: string): number | null {
  const trimmed = input.trim()
  if (!/^\d{1,3}(\.\d{3})+$|^\d+$/.test(trimmed)) return null
  const value = Number(trimmed.replace(/\./g, ''))
  return Number.isSafeInteger(value) && value >= 0 ? value : null
}

interface LinePreview {
  rule: PricingRule
  pricePerGram: number
  lineTotal: number
  gramsHundredths: number
}

interface SavedSale {
  id: number
}

interface LineBody {
  variety_id: number
  grams: string
  gift: boolean
  special_price: number | null
}

interface SaleBody {
  date: string
  customer_id: number | null
  shipping_charged: number
  note: string | null
  payment: 'cash' | 'transfer' | 'owing' | null
  lines: LineBody[]
}

const SUBMIT_OVERRIDES: Partial<
  Record<
    RefusalCode,
    { field: 'customer' | 'shipping' | 'note' | 'date' | 'payment' | 'form'; message: string }
  >
> = {
  'sale.owing_without_customer': { field: 'customer', message: OWING_HINT },
  'sale.shipping_negative': { field: 'shipping', message: 'El envío no puede ser negativo' },
  'sale.note_too_long': { field: 'note', message: 'La nota es demasiado larga' },
  'sale.date_in_future': { field: 'date', message: 'La fecha no puede ser futura' },
  'sale.payment_required': { field: 'payment', message: PAYMENT_REQUIRED_MESSAGE },
  'sale.customer_not_found': { field: 'form', message: GENERIC_REFUSAL },
  'sale.variety_not_found': { field: 'form', message: GENERIC_REFUSAL },
  'sale.lines_missing': { field: 'form', message: GENERIC_REFUSAL },
  'sale.gift_with_special_price': { field: 'form', message: GENERIC_REFUSAL },
  'sale.special_price_invalid': { field: 'form', message: GENERIC_REFUSAL },
  'sale.grams_invalid': { field: 'form', message: GENERIC_REFUSAL },
  'sale.rule_broken': { field: 'form', message: GENERIC_REFUSAL },
  'sale.price_quote_invalid': { field: 'form', message: GENERIC_REFUSAL },
}

export default function NuevaVenta() {
  const me = useOutletContext<Me>()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  const initialCustomerId = readNewSaleState(location.state)

  const [date, setDate] = useState(me.today)
  const [customerOverride, setCustomerOverride] = useState<Customer | null | undefined>(undefined)
  const [lines, setLines] = useState<LineState[]>([emptyLine()])
  const [shipping, setShipping] = useState('0')
  const [note, setNote] = useState('')
  const [method, setMethod] = useState<PaymentChoice | null>(null)
  const [showCustomerSheet, setShowCustomerSheet] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [shippingError, setShippingError] = useState<string | null>(null)
  const [noteError, setNoteError] = useState<string | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)

  const savedRef = useRef(false)

  const varietiesQuery = useQuery({
    queryKey: keys.saleFormVarieties(date),
    queryFn: () => get<Variety[]>(`/varieties?on=${encodeURIComponent(date)}`),
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const customerByIdQuery = useQuery({
    queryKey: keys.saleFormCustomer(initialCustomerId ?? ''),
    queryFn: () => get<Customer>(`/customers/${initialCustomerId ?? ''}`),
    enabled: initialCustomerId !== null,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const customer: Customer | null =
    customerOverride !== undefined ? customerOverride : (customerByIdQuery.data ?? null)
  const varieties = varietiesQuery.data ?? []

  function chooseCustomer(chosen: Customer | null): void {
    setCustomerOverride(chosen)
    if (chosen === null && method === 'owing') setMethod(null)
  }

  function updateLine(key: string, patch: Partial<LineState>): void {
    setLines((previous) => previous.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  function addLine(): void {
    setLines((previous) => [...previous, emptyLine()])
  }

  function removeLine(key: string): void {
    setLines((previous) => (previous.length > 1 ? previous.filter((line) => line.key !== key) : previous))
  }

  function varietyOf(id: string): Variety | undefined {
    return varieties.find((variety) => String(variety.id) === id)
  }

  function specialPriceOf(line: LineState): number | null {
    if (line.specialPrice.trim() === '') return null
    const parsed = parseMoney(line.specialPrice)
    return parsed.ok ? parsed.value : null
  }

  /** `parseMoney` (money.ts) already rejects `$0`, a decimal or a negative amount —
   * but today's code must still never fall silently back to list/bulk pricing for
   * such a line (sales.md: "Precio especial doesn't accept $0"). A line with
   * something typed in `specialPrice` that doesn't parse is its own error, distinct
   * from "no special price at all" (an empty field), and blocks saving the same way
   * `validateSale`'s own errors do. */
  function specialPriceErrorFor(line: LineState): string | null {
    if (line.specialPrice.trim() === '') return null
    return parseMoney(line.specialPrice).ok ? null : SPECIAL_PRICE_INVALID_MESSAGE
  }

  const lineValidations: LineValidation[] = lines
    .filter((line) => line.varietyId !== '')
    .map((line) => {
      const variety = varietyOf(line.varietyId)
      return {
        id: line.key,
        varietyName: variety?.name ?? '',
        gift: line.gift,
        specialPrice: specialPriceOf(line),
        quote: variety !== undefined ? quoteOf(variety) : null,
      }
    })

  const errors = validateSale({
    method,
    hasCustomer: customer !== null,
    lines: lineValidations,
  })

  function lineErrorFor(key: string): string | null {
    return errors.find((error) => error.field === `line:${key}`)?.message ?? null
  }

  /** The one message a line shows, in priority order: an invalid typed special
   * price first (it is why the line isn't pricing at all), then `validateSale`'s
   * own "no price that day". */
  function combinedLineError(line: LineState): string | null {
    return specialPriceErrorFor(line) ?? lineErrorFor(line.key)
  }

  function previewOf(line: LineState): LinePreview | null {
    if (line.varietyId === '') return null
    const variety = varietyOf(line.varietyId)
    if (variety === undefined) return null
    if (specialPriceErrorFor(line) !== null) return null
    const grams = parseGrams(line.grams)
    if (!grams.ok) return null
    const quote = quoteOf(variety)
    const specialPrice = specialPriceOf(line)
    if (!line.gift && specialPrice === null && quote === null) return null
    try {
      const priced = priceLine({
        gift: line.gift,
        specialPrice,
        vip: customer?.vip ?? false,
        quote,
        gramsHundredths: toHundredths(grams.value),
      })
      return { ...priced, gramsHundredths: toHundredths(grams.value) }
    } catch {
      return null
    }
  }

  const previews = lines.map((line) => previewOf(line))
  const totals = saleTotals(
    lines.map((line, index) => {
      const preview = previews[index]
      return {
        gift: line.gift,
        gramsHundredths: preview?.gramsHundredths ?? 0,
        lineTotal: preview?.lineTotal ?? 0,
      }
    }),
    parseShipping(shipping) ?? 0,
  )

  const touched =
    customer !== null ||
    note.trim() !== '' ||
    shipping !== '0' ||
    lines.some(
      (line) => line.varietyId !== '' || line.grams !== '' || line.gift || line.specialPrice !== '',
    )
  const touchedRef = useRef(touched)
  useEffect(() => {
    touchedRef.current = touched
  }, [touched])
  const shouldBlock = useCallback(() => touchedRef.current && !savedRef.current, [])
  const blocker = useBlocker(shouldBlock)

  const save = useMutation({
    mutationFn: (body: SaleBody) => post<SavedSale>('/sales', body),
  })

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setFormError(null)
    setShippingError(null)
    setNoteError(null)
    setDateError(null)
    setPaymentError(null)
    setOffline(false)

    if (errors.length > 0) return
    if (lines.some((line) => specialPriceErrorFor(line) !== null)) return

    const filled = lines.filter((line) => line.varietyId !== '')
    if (filled.length === 0) {
      setFormError(NO_LINES_MESSAGE)
      return
    }
    const shippingCharged = parseShipping(shipping)
    if (shippingCharged === null) {
      setShippingError('El envío no puede ser negativo')
      return
    }

    const body: SaleBody = {
      date,
      customer_id: customer?.id ?? null,
      shipping_charged: shippingCharged,
      note: note.trim() === '' ? null : note,
      payment: method,
      lines: filled.map((line) => {
        const grams = parseGrams(line.grams)
        return {
          variety_id: Number(line.varietyId),
          grams: grams.ok ? grams.value : '0',
          gift: line.gift,
          special_price: specialPriceOf(line),
        }
      }),
    }

    try {
      const saved = await save.mutateAsync(body)
      savedRef.current = true
      navigate(`/ventas/${saved.id}`, { replace: true, state: saleJustSaved() })
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        // The session boundary already cleared the cache and is navigating to
        // Entrar (queryClient.ts's MutationCache.onError).
        return
      }
      if (caught instanceof ApiError && caught.code === 'sale.no_price_that_day') {
        // The one other refetch (plan, invariants): a partner may have deleted the
        // price between this form's own fetch and now. Refetching makes that
        // line's quote `null` again, so the live preview's own `NoPriceThatDay`
        // message appears on it, naming the variety from this screen's own line.
        void queryClient.invalidateQueries({ queryKey: keys.saleFormVarieties(date) })
        return
      }
      if (caught instanceof ApiError) {
        const override = resolveOverride(SUBMIT_OVERRIDES, caught.code)
        if (override !== undefined) {
          if (override.field === 'shipping') setShippingError(override.message)
          else if (override.field === 'note') setNoteError(override.message)
          else if (override.field === 'date') setDateError(override.message)
          else if (override.field === 'payment') setPaymentError(override.message)
          else setFormError(override.message)
        } else if (caught.code !== UNKNOWN_CODE) {
          setFormError(GENERIC_REFUSAL)
        } else {
          setFormError(ERROR_GENERICO_MENSAJE)
        }
      } else if (caught instanceof NetworkError) {
        setOffline(true)
      } else {
        setFormError(ERROR_GENERICO_MENSAJE)
      }
    }
  }

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div className="encabezado-fila">
          <span className="encabezado__titulo">Nueva venta</span>
          <button
            type="button"
            className="boton-icono"
            aria-label="Cerrar"
            onClick={() => navigate('/ventas')}
          >
            ×
          </button>
        </div>

        <form className="formulario" onSubmit={onSubmit}>
          <label className="campo">
            <span className="campo__rotulo">Fecha</span>
            <input
              className="campo__input"
              type="date"
              value={date}
              max={maxSaleDate(me.today)}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>
          <span className="rotulo">
            {date === me.today ? `Hoy ${formatDateShort(date)}` : formatDateLong(date)}
          </span>
          {dateError !== null && (
            <span className="campo__error" role="alert">
              {dateError}
            </span>
          )}

          <div className="campo">
            <span className="campo__rotulo">Cliente</span>
            {customer === null ? (
              <button
                type="button"
                className="boton boton--suave"
                onClick={() => setShowCustomerSheet(true)}
              >
                Elegir cliente
              </button>
            ) : (
              <div className="fila">
                <span className="lista-clientes__nombre">
                  {customer.name}
                  {customer.vip && <span className="vip-insignia">VIP</span>}
                </span>
                <button
                  type="button"
                  className="boton-enlace"
                  onClick={() => setShowCustomerSheet(true)}
                >
                  Cambiar
                </button>
              </div>
            )}
          </div>

          {lines.map((line, index) => {
            const preview = previews[index] ?? null
            const lineError = combinedLineError(line)
            return (
              <div key={line.key} className="fila">
                <select
                  className="campo__input"
                  aria-label={`Variedad línea ${index + 1}`}
                  value={line.varietyId}
                  onChange={(event) => updateLine(line.key, { varietyId: event.target.value })}
                  required
                >
                  <option value="">Elegí una variedad</option>
                  {varieties.map((variety) => (
                    <option key={variety.id} value={variety.id}>
                      {variety.name}
                    </option>
                  ))}
                </select>
                <input
                  className="campo__input"
                  aria-label={`Gramos línea ${index + 1}`}
                  type="text"
                  inputMode="decimal"
                  value={line.grams}
                  onChange={(event) => updateLine(line.key, { grams: event.target.value })}
                  required
                />
                <label>
                  <input
                    type="checkbox"
                    aria-label={`Regalo línea ${index + 1}`}
                    checked={line.gift}
                    disabled={line.specialPrice.trim() !== ''}
                    onChange={(event) => updateLine(line.key, { gift: event.target.checked })}
                  />
                  Regalo
                </label>
                <input
                  className="campo__input"
                  aria-label={`Precio especial línea ${index + 1}`}
                  type="text"
                  inputMode="numeric"
                  placeholder="Precio especial"
                  value={line.specialPrice}
                  disabled={line.gift}
                  onChange={(event) => updateLine(line.key, { specialPrice: event.target.value })}
                />
                {lineError !== null && (
                  <span className="campo__error" role="alert">
                    {lineError}
                  </span>
                )}
                {lineError === null && preview !== null && (
                  <div className="fila">
                    <span className="regla-insignia">{RULE_LABEL[preview.rule]}</span>
                    <span>{formatMoney(preview.pricePerGram)} x g</span>
                    <span>{formatMoney(preview.lineTotal)}</span>
                  </div>
                )}
                {lines.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Quitar línea ${index + 1}`}
                    onClick={() => removeLine(line.key)}
                  >
                    ×
                  </button>
                )}
              </div>
            )
          })}
          <button type="button" className="boton boton--suave" onClick={addLine}>
            Agregar variedad
          </button>

          <label className="campo">
            <span className="campo__rotulo">Envío</span>
            <input
              className="campo__input"
              type="text"
              inputMode="numeric"
              value={shipping}
              onChange={(event) => setShipping(event.target.value)}
            />
          </label>
          {shippingError !== null && (
            <span className="campo__error" role="alert">
              {shippingError}
            </span>
          )}

          <label className="campo">
            <span className="campo__rotulo">Nota</span>
            <textarea
              className="campo__input"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          {noteError !== null && (
            <span className="campo__error" role="alert">
              {noteError}
            </span>
          )}

          <fieldset className="campo">
            <legend className="campo__rotulo">Cómo se pagó</legend>
            <label>
              <input
                type="radio"
                name="payment"
                checked={method === 'cash'}
                onChange={() => setMethod('cash')}
              />
              Efectivo
            </label>
            <label>
              <input
                type="radio"
                name="payment"
                checked={method === 'transfer'}
                onChange={() => setMethod('transfer')}
              />
              Transferencia
            </label>
            <label>
              <input
                type="radio"
                name="payment"
                checked={method === 'owing'}
                disabled={customer === null}
                onChange={() => setMethod('owing')}
              />
              Debiendo
            </label>
            {customer === null && (
              <span className="campo__error" role="alert">
                {OWING_HINT}
              </span>
            )}
            {paymentError !== null && (
              <span className="campo__error" role="alert">
                {paymentError}
              </span>
            )}
          </fieldset>

          <div className="fila">
            <span className="cifra-m">{formatMoney(totals.total)}</span>
            <span className="rotulo">{formatGrams(fromHundredths(totals.gramsSoldHundredths))} vendidos</span>
            {totals.gramsGiftedHundredths > 0 && (
              <span className="rotulo">
                {formatGrams(fromHundredths(totals.gramsGiftedHundredths))} regalados
              </span>
            )}
          </div>

          {formError !== null && (
            <span className="campo__error" role="alert">
              {formError}
            </span>
          )}
          {offline && <SinConexion />}

          <button
            className="boton"
            type="submit"
            disabled={save.isPending || varietiesQuery.isFetching}
          >
            Guardar venta
          </button>
        </form>
      </div>

      {showCustomerSheet && (
        <NuevaVentaCliente
          allowNone
          onChosen={chooseCustomer}
          onClose={() => setShowCustomerSheet(false)}
        />
      )}

      {blocker.state === 'blocked' && (
        <ConfirmDialog
          title="¿Descartás la venta?"
          detail="No vas a poder recuperar lo que cargaste."
          confirmText="Sí, descartala"
          cancelText="No, seguí cargando"
          onConfirm={() => blocker.proceed()}
          onCancel={() => blocker.reset()}
        />
      )}
    </main>
  )
}
