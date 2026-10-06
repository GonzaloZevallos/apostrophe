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
 * The leave guard (`useLeaveGuard`, invariants: "reading a ref at call time") only
 * blocks Back/close once something has been typed, and never blocks the
 * replace-navigation a successful save performs — `disarm()` short-circuits the
 * blocker's predicate once `onSubmit` has already saved.
 *
 * The line editor (plan, "Binding UX decision: the line editor" — no design file
 * draws it): one open line at a time, in place. `openKey` names which line is
 * open; every other line renders as the design's closed row (name, grams as a
 * large figure, price per gram, `ReglaInsignia` and the line total) or, when it
 * carries a message with no valid preview, as an incomplete row (the variety name
 * or "Sin variedad" plus that message, never figures). `combinedLineError` is the
 * one source of a line's message, in the plan's priority order.
 */

import { SALE, SALES, pathTo } from '../../routes'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router'
import { ApiError, NetworkError, UNKNOWN_CODE, get, post } from '../../api/client'
import type { Customer } from '../../api/customers'
import { keys } from '../../api/keys'
import type { Me } from '../../api/me'
import { resolveOverride, type RefusalCode } from '../../api/refusals'
import Boton from '../../components/Boton'
import { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import { readNewSaleState, saleJustSaved } from '../../components/feedback'
import Icono from '../../components/Icono'
import LeaveConfirm from '../../components/LeaveConfirm'
import ReglaInsignia from '../../components/ReglaInsignia'
import SelectorPago from '../../components/SelectorPago'
import SinConexion from '../../components/SinConexion'
import { useLeaveGuard } from '../../components/useLeaveGuard'
import { formatDateLong, formatDateShort, maxSaleDate } from '../../format/dates'
import { formatGrams, formatMoney } from '../../format/money'
import { parseGrams, parseMoney } from '../../format/parse'
import {
  type LineValidation,
  type PaymentChoice,
  type PriceQuote,
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
export const LINE_GRAMS_INVALID = 'Cargá los gramos: coma, hasta dos decimales'
export const LINE_VARIETY_MISSING = 'Elegí una variedad'

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

function isBlank(line: LineState): boolean {
  return line.varietyId === '' && line.grams.trim() === '' && !line.gift && line.specialPrice.trim() === ''
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

/** `scrollIntoView` doesn't exist in the jsdom the component's own tests render
 * under; guarded so an open field's focus handler is a no-op there instead of a
 * thrown error, and still scrolls a real phone's viewport into place (plan,
 * "Phone layout": "Open fields call `scrollIntoView({block: 'nearest'})` on
 * focus"). */
function scrollFieldIntoView(element: HTMLElement): void {
  if (typeof element.scrollIntoView === 'function') element.scrollIntoView({ block: 'nearest' })
}

interface LinePreview {
  rule: ReturnType<typeof priceLine>['rule']
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
  const [lines, setLines] = useState<LineState[]>(() => [emptyLine()])
  const [openKey, setOpenKey] = useState<string>(() => lines[0]?.key ?? '')
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
  const [focusRequest, setFocusRequest] = useState<{
    lineKey: string
    field: 'variety' | 'grams' | 'specialPrice'
    nonce: number
  } | null>(null)
  const focusNonceRef = useRef(0)

  const varietyFieldRef = useRef<HTMLSelectElement | null>(null)
  const gramsFieldRef = useRef<HTMLInputElement | null>(null)
  const specialPriceFieldRef = useRef<HTMLInputElement | null>(null)

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

  /** Opens `targetKey` in place, closing whatever was open — removing it first if
   * it was left blank and the sale has more than one line (plan: "a line closed
   * with nothing typed is removed, unless it is the sale's only line"). */
  function openLine(targetKey: string): void {
    if (targetKey === openKey) return
    setLines((previous) => {
      const current = previous.find((line) => line.key === openKey)
      if (current !== undefined && isBlank(current) && previous.length > 1) {
        return previous.filter((line) => line.key !== current.key)
      }
      return previous
    })
    setOpenKey(targetKey)
  }

  /** "Agregar otra variedad": always ends with exactly one more open line than
   * before, dropping the just-open line first if it was left blank. */
  function addLine(): void {
    const created = emptyLine()
    setLines((previous) => {
      const withoutBlankOpen = previous.filter((line) => !(line.key === openKey && isBlank(line)))
      return [...withoutBlankOpen, created]
    })
    setOpenKey(created.key)
  }

  /** "Quitar", only offered on the open line when the sale has more than one —
   * the next open line is whichever remains first. */
  function removeLine(key: string): void {
    setLines((previous) => {
      if (previous.length <= 1) return previous
      const next = previous.filter((line) => line.key !== key)
      const nextFirst = next[0]
      if (key === openKey && nextFirst !== undefined) setOpenKey(nextFirst.key)
      return next
    })
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

  function noPriceErrorFor(key: string): string | null {
    return errors.find((error) => error.field === `line:${key}`)?.message ?? null
  }

  /** The one message a line shows, in the plan's priority order: an invalid typed
   * special price; `validateSale`'s "no price that day"; bad grams; a missing
   * variety when something else was typed. A fully blank line never reaches here
   * closed (it is removed instead), so returning `null` here only ever means a
   * line that prices cleanly. */
  function combinedLineError(line: LineState): string | null {
    const special = specialPriceErrorFor(line)
    if (special !== null) return special
    const noPrice = noPriceErrorFor(line.key)
    if (noPrice !== null) return noPrice
    const gramsTyped = line.grams.trim() !== ''
    const somethingTyped = line.varietyId !== '' || gramsTyped || line.gift || line.specialPrice.trim() !== ''
    if (!parseGrams(line.grams).ok && somethingTyped) return LINE_GRAMS_INVALID
    if (line.varietyId === '' && somethingTyped) return LINE_VARIETY_MISSING
    return null
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
    lines.some((line) => !isBlank(line))
  const { blocker, disarm } = useLeaveGuard(touched)

  const save = useMutation({
    mutationFn: (body: SaleBody) => post<SavedSale>('/sales', body),
  })

  // Saving with a line in error opens and focuses that field (plan, "Saving"):
  // `openLine` may or may not change `openKey` (the line could already be open),
  // so the actual `.focus()` call waits for this effect, which re-runs once a
  // fresh `focusRequest` lands, after the line's own fields are on the page. The
  // request's own `nonce` (never reset) is what re-triggers the effect on a
  // second save with the same field at fault — a plain `setState` inside the
  // effect would only start another, unnecessary render (oxlint's own
  // `set-state-in-effect`). Guarded on `openKey === focusRequest.lineKey`, so a
  // stale request from an earlier save never steals focus back from a line the
  // seller opened by hand afterwards — only the field this same request named,
  // on the line it named, is ever focused.
  useEffect(() => {
    if (focusRequest === null || focusRequest.lineKey !== openKey) return
    const ref =
      focusRequest.field === 'grams'
        ? gramsFieldRef
        : focusRequest.field === 'specialPrice'
          ? specialPriceFieldRef
          : varietyFieldRef
    ref.current?.focus()
  }, [focusRequest, openKey])

  function fieldForError(line: LineState): 'variety' | 'grams' | 'specialPrice' {
    if (specialPriceErrorFor(line) !== null) return 'specialPrice'
    if (noPriceErrorFor(line.key) !== null) return 'variety'
    if (!parseGrams(line.grams).ok) return 'grams'
    return 'variety'
  }

  function goBack(): void {
    if (location.key === 'default') navigate(SALES)
    else navigate(-1)
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setFormError(null)
    setShippingError(null)
    setNoteError(null)
    setDateError(null)
    setPaymentError(null)
    setOffline(false)

    const firstInError = lines.find((line) => combinedLineError(line) !== null)
    if (firstInError !== undefined) {
      openLine(firstInError.key)
      focusNonceRef.current += 1
      setFocusRequest({
        lineKey: firstInError.key,
        field: fieldForError(firstInError),
        nonce: focusNonceRef.current,
      })
      return
    }

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
      disarm()
      navigate(pathTo(SALE, { id: saved.id }), { replace: true, state: saleJustSaved() })
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        // The session boundary already cleared the cache and is navigating to
        // Entrar (queryClient.ts's MutationCache.onError).
        return
      }
      if (caught instanceof ApiError && caught.code === 'sale.no_price_that_day') {
        // The one other refetch (plan, invariants): a partner may have deleted the
        // price between this form's own fetch and now. Awaited, so the cache
        // already carries the fresh answer below — reading it straight from the
        // cache rather than `varieties` (this closure's own, from the render that
        // started this submit) is what lets the line that lost its price open and
        // focus right away, instead of waiting for a render this handler doesn't
        // itself cause.
        await queryClient.invalidateQueries({ queryKey: keys.saleFormVarieties(date) })
        const freshVarieties = queryClient.getQueryData<Variety[]>(keys.saleFormVarieties(date)) ?? []
        const flagged = lines.find((line) => {
          if (line.varietyId === '' || line.gift || specialPriceOf(line) !== null) return false
          const variety = freshVarieties.find((item) => String(item.id) === line.varietyId)
          return variety === undefined || quoteOf(variety) === null
        })
        if (flagged !== undefined) {
          openLine(flagged.key)
          focusNonceRef.current += 1
          setFocusRequest({ lineKey: flagged.key, field: 'variety', nonce: focusNonceRef.current })
        }
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
      <form className="nueva-venta" onSubmit={onSubmit}>
        <div className="nueva-venta__disposicion">
        <div className="nueva-venta__cuerpo">
          <div className="encabezado-fila">
            <Boton variant="icon" ariaLabel="Volver" icon="atras" onClick={goBack} />
            <span className="encabezado__titulo">Nueva venta</span>
            <span className="fecha-pildora">
              <input
                className="fecha-pildora__input"
                type="date"
                aria-label="Fecha"
                value={date}
                max={maxSaleDate(me.today)}
                onChange={(event) => setDate(event.target.value)}
                required
              />
              <span className="fecha-pildora__texto" aria-hidden="true">
                {date === me.today ? `Hoy ${formatDateShort(date)}` : formatDateLong(date)}
                <Icono nombre="abajo" size={15} strokeWidth={1.8} />
              </span>
            </span>
          </div>
          {dateError !== null && (
            <span className="campo__error" role="alert">
              {dateError}
            </span>
          )}

          {customer === null ? (
            <Boton variant="secondary" onClick={() => setShowCustomerSheet(true)}>
              Elegir cliente
            </Boton>
          ) : (
            <Boton variant="row" onClick={() => setShowCustomerSheet(true)}>
              <div className="nueva-venta__cliente">
                <div className="nueva-venta__cliente-texto">
                  <span className="lista-clientes__nombre">
                    {customer.name}
                    {customer.vip && <span className="vip-insignia">VIP</span>}
                  </span>
                  {customer.phone !== null && (
                    <span className="nueva-venta__cliente-telefono">{customer.phone}</span>
                  )}
                </div>
                <span className="nueva-venta__cliente-cambiar">Cambiar</span>
              </div>
            </Boton>
          )}

          <div className="nueva-venta__lineas">
            {lines.map((line, index) => {
              const n = index + 1
              const preview = previews[index] ?? null
              const lineError = combinedLineError(line)
              const variety = varietyOf(line.varietyId)
              const isOpen = line.key === openKey

              if (!isOpen) {
                const displayName = variety?.name ?? 'Sin variedad'
                const messageId = `linea-mensaje-${line.key}`
                return (
                  <Boton
                    key={line.key}
                    variant="row"
                    ariaLabel={`Línea ${n}: ${displayName}`}
                    ariaDescribedBy={lineError !== null ? messageId : undefined}
                    onClick={() => openLine(line.key)}
                  >
                    <div className="nueva-venta__linea-encabezado">
                      <span className="nueva-venta__linea-nombre">{displayName}</span>
                      {preview !== null && (
                        <span className="nueva-venta__linea-gramos">
                          {formatGrams(fromHundredths(preview.gramsHundredths))} g
                        </span>
                      )}
                    </div>
                    {preview !== null && (
                      <div className="nueva-venta__linea-detalle">
                        {preview.rule !== 'gift' && (
                          <span className="nueva-venta__linea-preciogramo">
                            {formatMoney(preview.pricePerGram)} x g
                          </span>
                        )}
                        <ReglaInsignia rule={preview.rule} />
                        <span className="nueva-venta__linea-total">{formatMoney(preview.lineTotal)}</span>
                      </div>
                    )}
                    {lineError !== null && (
                      <span id={messageId} className="campo__error" role="alert">
                        {lineError}
                      </span>
                    )}
                  </Boton>
                )
              }

              return (
                <div key={line.key} className="nueva-venta__linea nueva-venta__linea--abierta">
                  <label className="campo">
                    <span className="campo__rotulo">Variedad</span>
                    <select
                      className="campo__input"
                      aria-label={`Variedad línea ${n}`}
                      value={line.varietyId}
                      ref={varietyFieldRef}
                      onFocus={(event) => scrollFieldIntoView(event.currentTarget)}
                      onChange={(event) => updateLine(line.key, { varietyId: event.target.value })}
                    >
                      <option value="">Elegí una variedad</option>
                      {varieties.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="campo">
                    <span className="campo__rotulo">Gramos</span>
                    <input
                      className="campo__input"
                      aria-label={`Gramos línea ${n}`}
                      type="text"
                      inputMode="decimal"
                      value={line.grams}
                      ref={gramsFieldRef}
                      onFocus={(event) => scrollFieldIntoView(event.currentTarget)}
                      onChange={(event) => updateLine(line.key, { grams: event.target.value })}
                    />
                    <span className="campo__ayuda">Coma, hasta dos decimales</span>
                  </label>
                  <div className="nueva-venta__linea-opciones">
                    <label>
                      <input
                        type="checkbox"
                        aria-label={`Regalo línea ${n}`}
                        checked={line.gift}
                        disabled={line.specialPrice.trim() !== ''}
                        onFocus={(event) => scrollFieldIntoView(event.currentTarget)}
                        onChange={(event) => updateLine(line.key, { gift: event.target.checked })}
                      />
                      Regalo
                    </label>
                    <input
                      className="campo__input"
                      aria-label={`Precio especial línea ${n}`}
                      type="text"
                      inputMode="numeric"
                      placeholder="Precio especial"
                      value={line.specialPrice}
                      disabled={line.gift}
                      ref={specialPriceFieldRef}
                      onFocus={(event) => scrollFieldIntoView(event.currentTarget)}
                      onChange={(event) => updateLine(line.key, { specialPrice: event.target.value })}
                    />
                  </div>
                  {lineError !== null && (
                    <span className="campo__error" role="alert">
                      {lineError}
                    </span>
                  )}
                  {lineError === null && preview !== null && (
                    <div className="nueva-venta__linea-detalle">
                      {preview.rule !== 'gift' && (
                        <span className="nueva-venta__linea-preciogramo">
                          {formatMoney(preview.pricePerGram)} x g
                        </span>
                      )}
                      <ReglaInsignia rule={preview.rule} />
                      <span className="nueva-venta__linea-total">{formatMoney(preview.lineTotal)}</span>
                    </div>
                  )}
                  {lines.length > 1 && (
                    <Boton variant="link" ariaLabel={`Quitar línea ${n}`} onClick={() => removeLine(line.key)}>
                      Quitar
                    </Boton>
                  )}
                </div>
              )
            })}
          </div>
          <Boton variant="link" onClick={addLine}>
            Agregar otra variedad
          </Boton>

          <div className="nueva-venta__fila-dato">
            <span>Envío cobrado</span>
            <input
              className="campo__input"
              aria-label="Envío"
              type="text"
              inputMode="numeric"
              value={shipping}
              onChange={(event) => setShipping(event.target.value)}
            />
          </div>
          {shippingError !== null && (
            <span className="campo__error" role="alert">
              {shippingError}
            </span>
          )}

          <div className="nueva-venta__fila-dato">
            <span>Nota</span>
            <textarea
              className="campo__input"
              aria-label="Nota"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          {noteError !== null && (
            <span className="campo__error" role="alert">
              {noteError}
            </span>
          )}

          {formError !== null && (
            <span className="campo__error" role="alert">
              {formError}
            </span>
          )}
          {offline && <SinConexion />}
        </div>

        <div className="nueva-venta__resumen">
          <div className="nueva-venta__pago">
            <SelectorPago
              value={method}
              onChange={setMethod}
              owingDisabled={customer === null}
              owingDescription={OWING_HINT}
            />
            {paymentError !== null && (
              <span className="campo__error" role="alert">
                {paymentError}
              </span>
            )}
          </div>

          <div className="nueva-venta__pie">
            <span className="rotulo">Total</span>
            <span className="cifra-xl">{formatMoney(totals.total)}</span>
            <span className="rotulo">
              {formatGrams(fromHundredths(totals.gramsSoldHundredths))} vendidos
              {totals.gramsGiftedHundredths > 0 &&
                ` · ${formatGrams(fromHundredths(totals.gramsGiftedHundredths))} de regalo`}
            </span>
            <Boton type="submit" disabled={save.isPending || varietiesQuery.isFetching}>
              Guardá la venta
            </Boton>
          </div>
        </div>
        </div>
      </form>

      {showCustomerSheet && (
        <NuevaVentaCliente
          allowNone
          onChosen={chooseCustomer}
          onClose={() => setShowCustomerSheet(false)}
        />
      )}

      {blocker.state === 'blocked' && (
        <LeaveConfirm
          blocker={blocker}
          question="¿Descartás la venta?"
          detail="No vas a poder recuperar lo que cargaste."
          keepLabel="No, seguí cargando"
          discardLabel="Sí, descartala"
        />
      )}
    </main>
  )
}
