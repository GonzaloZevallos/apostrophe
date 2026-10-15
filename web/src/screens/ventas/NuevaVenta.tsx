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

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router'
import { ApiError, NetworkError, UNKNOWN_CODE, get, post } from '../../api/client'
import type { Customer } from '../../api/customers'
import { keys } from '../../api/keys'
import type { Me } from '../../api/me'
import type { PricingSettings as ApiPricingSettings } from '../../api/pricingSettings'
import { resolveOverride, type RefusalCode } from '../../api/refusals'
import Boton from '../../components/Boton'
import { SALE, SALES, pathTo } from '../../routes'
import { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import { readNewSaleState, saleJustSaved } from '../../components/feedback'
import Icono from '../../components/Icono'
import LeaveConfirm from '../../components/LeaveConfirm'
import Loading, { LoadingAnuncio } from '../../components/Loading'
import SelectorPago from '../../components/SelectorPago'
import SinConexion from '../../components/SinConexion'
import { useBackOr } from '../../components/useBackOr'
import { useLeaveGuard } from '../../components/useLeaveGuard'
import { SheetStackProvider, useSheet } from '../../components/useSheetStack'
import { useVisualViewport } from '../../components/useVisualViewport'
import { formatDateLong, formatDateShort, maxSaleDate } from '../../format/dates'
import { formatGrams, formatMoney } from '../../format/money'
import { parseGrams, parseMoney } from '../../format/parse'
import {
  type LineValidation,
  type PaymentChoice,
  type PriceQuote,
  type PricingSettings,
  fromHundredths,
  hundredthsOfApiGrams,
  priceLine,
  saleTotals,
  toHundredths,
  validateSale,
} from '../../sales/pricing'
import { OWING_HINT } from '../../sales/messages'
import type { Variety } from '../Variedades'
import NuevaVentaCliente from './NuevaVentaCliente'
import NuevaVentaLinea, { type LinePreview, type LineState } from './NuevaVentaLinea'

export const GENERIC_REFUSAL = 'Revisá los datos e intentá de nuevo.'
export const NO_LINES_MESSAGE = 'Cargá al menos una variedad.'
export { OWING_HINT }
export const PAYMENT_REQUIRED_MESSAGE = 'Elegí cómo se pagó, o dejá la venta debiendo'
export const SPECIAL_PRICE_INVALID_MESSAGE = 'El precio especial tiene que ser mayor a $0'
export const LINE_GRAMS_INVALID = 'Cargá los gramos: coma, hasta dos decimales'
export const LINE_VARIETY_MISSING = 'Elegí una variedad'

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
  return { listPrice: price.list_price, bulk, vipPrice: price.vip_price }
}

/** Both rules off: what prices a line while the switches have not come, or could not be read.
 * A rule that is off never shows, so the safe side is no rule (`pricing-settings.md`). */
const NO_RULES: PricingSettings = { bulk: false, vip: false }

/** Whole pesos, zero or more — unlike `parseMoney` (money.ts), which rejects zero:
 * shipping charged is `$0` by default and that is a valid value to save with. */
function parseShipping(input: string): number | null {
  const trimmed = input.trim()
  if (!/^\d{1,3}(\.\d{3})+$|^\d+$/.test(trimmed)) return null
  const value = Number(trimmed.replace(/\./g, ''))
  return Number.isSafeInteger(value) && value >= 0 ? value : null
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

/** One sheet stack per screen (ADR-0027): Elegir cliente is level 1, Nuevo cliente level 2. */
export default function NuevaVenta() {
  return (
    <SheetStackProvider>
      <NuevaVentaForm />
    </SheetStackProvider>
  )
}

function NuevaVentaForm() {
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
  const customerSheet = useSheet(1)
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
  const formRef = useRef<HTMLFormElement | null>(null)
  useVisualViewport(formRef)

  const varietyFieldRef = useRef<HTMLSelectElement | null>(null)
  const gramsFieldRef = useRef<HTMLInputElement | null>(null)
  const specialPriceFieldRef = useRef<HTMLInputElement | null>(null)

  const varietiesQuery = useQuery({
    queryKey: keys.saleFormVarieties(date),
    queryFn: () => get<Variety[]>(`/varieties?on=${encodeURIComponent(date)}`),
    // A date change keeps the form's varieties (names, options) while that day's prices
    // come; no figure of the previous day is ever shown (`repricing` below).
    placeholderData: keepPreviousData,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  // The switches come with each day's prices: on opening and on every date change.
  const settingsQuery = useQuery({
    queryKey: keys.saleFormPricingSettings(date),
    queryFn: () => get<ApiPricingSettings>('/pricing-settings'),
    placeholderData: keepPreviousData,
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
  // Until the first prices arrive the body is the shared loading state; after a date change
  // the form stays and every figure that depends on a price waits behind a compact bar.
  const opening = varietiesQuery.isPending || settingsQuery.isPending
  const repricing = varietiesQuery.isPlaceholderData || settingsQuery.isPlaceholderData
  const settings: PricingSettings =
    settingsQuery.data === undefined
      ? NO_RULES
      : { bulk: settingsQuery.data.is_bulk_pricing, vip: settingsQuery.data.is_vip_customers }

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
    const noPrice = repricing ? null : noPriceErrorFor(line.key)
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
        customerIsVip: customer?.vip ?? false,
        settings,
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

  const close = useBackOr(SALES)

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
      <form ref={formRef} className="nueva-venta" onSubmit={onSubmit}>
        <div className="nueva-venta__disposicion">
        <div className="nueva-venta__cuerpo" aria-busy={repricing || opening || undefined}>
          <div className="encabezado-fila nueva-venta__cabecera">
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
                <Icono nombre="abajo" />
              </span>
            </span>
            <span className="nueva-venta__cerrar">
              <Boton variant="icon" action="close" ariaLabel="Cerrar" onClick={close} />
            </span>
          </div>
          {dateError !== null && (
            <span className="campo__error" role="alert">
              {dateError}
            </span>
          )}

          {opening ? (
            <Loading />
          ) : (
            <>
              {repricing && !customerSheet.isOpen && <LoadingAnuncio />}
              {customer === null ? (
                <Boton variant="secondary" icon="clientes" onClick={customerSheet.open}>
                  Elegir cliente
                </Boton>
              ) : (
                <Boton variant="row" onClick={customerSheet.open}>
                  <div className="nueva-venta__cliente">
                    <div className="nueva-venta__cliente-texto">
                      <span className="lista-clientes__nombre">
                        {customer.name}
                        {settings.vip && customer.vip && <span className="vip-insignia">VIP</span>}
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
                {lines.map((line, index) => (
                  <NuevaVentaLinea
                    key={line.key}
                    n={index + 1}
                    line={line}
                    isOpen={line.key === openKey}
                    preview={previews[index] ?? null}
                    error={combinedLineError(line)}
                    figuresLoading={repricing && line.varietyId !== '' && parseGrams(line.grams).ok}
                    variety={varietyOf(line.varietyId)}
                    varieties={varieties}
                    canRemove={lines.length > 1}
                    varietyRef={varietyFieldRef}
                    gramsRef={gramsFieldRef}
                    specialPriceRef={specialPriceFieldRef}
                    onOpen={() => openLine(line.key)}
                    onChange={(patch) => updateLine(line.key, patch)}
                    onRemove={() => removeLine(line.key)}
                  />
                ))}
              </div>
              <Boton variant="secondary" icon="agregar" onClick={addLine}>
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
            </>
          )}
        </div>

        {!opening && (
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
              <span className="cifra-xl">
                {repricing ? <Loading compacto /> : formatMoney(totals.total)}
              </span>
              <span className="rotulo nueva-venta__gramos">
                {formatGrams(fromHundredths(totals.gramsSoldHundredths))} vendidos
                {totals.gramsGiftedHundredths > 0 &&
                  ` · ${formatGrams(fromHundredths(totals.gramsGiftedHundredths))} de regalo`}
              </span>
              <Boton textOnly="submit" type="submit" disabled={save.isPending || varietiesQuery.isFetching || settingsQuery.isFetching}>
                Guardá la venta
              </Boton>
            </div>
          </div>
        )}
        </div>
      </form>

      {customerSheet.isOpen && <NuevaVentaCliente allowNone onChosen={chooseCustomer} />}

      {blocker.state === 'blocked' && (
        <div className="nueva-venta__aviso">
          <LeaveConfirm
            blocker={blocker}
            question="¿Descartás la venta?"
            detail="No vas a poder recuperar lo que cargaste."
            keepLabel="No, seguí cargando"
            discardLabel="Sí, descartala"
          />
        </div>
      )}
    </main>
  )
}
