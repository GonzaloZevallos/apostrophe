/**
 * New sale's Product list (`docs/product/sale-in-progress.md`, "Lista de Products de New sale"):
 * the lines of the sale with their steppers, then the Most sold rows, then the hint when nothing
 * is sellable. Not mounted by any route until the flip part of GH-496.
 *
 * Every figure is `pricing.ts`'s: the lines' price per unit is `priceSale` over the draft's own
 * lines (shipping 0), every other row's is `rowPrices`; "No price" renders exactly when that
 * pricing is `null`. The component computes no money and no quantity, and reads `current_price`
 * nowhere (`nothingSellable` does, for the hint).
 *
 * The search field always shows and keeps its text (local state, carried nowhere). While it holds text,
 * "Results · N" and the matches in name order replace the hint and the two sections; matching, sorting and
 * the highlight are `selectorSearch.ts`'s. No barcode scan and no category select: the Products have
 * neither.
 *
 * Until the loading and failure states land in their own part, one guard decides: while any read is
 * pending, a date's Products are not in, a read failed or the Customer is `'pending'`, the hint, the
 * sections and the results render nothing (no stand-in UI; the field stays). The draft keeps every line
 * meanwhile.
 */

import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { keys } from '../../api/keys'
import { readStock } from '../../api/stock'
import Boton from '../../components/Boton'
import Icono from '../../components/Icono'
import { foldForSearch, matchesQuery, matchRange } from '../../components/selectorSearch'
import { formatQuantity } from '../../format/money'
import { useMoney } from '../../format/moneyContext'
import { NO_PRICE_HINT, SALES_TEXT } from '../../copy/sales'
import { nothingSellable } from '../../sales/nothingSellable'
import {
  priceSale,
  rowPrices,
  signedHundredthsOfApiGrams,
  type LinePricing,
  type PricingSettings,
} from '../../sales/pricing'
import { MOST_SOLD_ROWS, mostSoldRows } from '../../sales/productList'
import { saleLineInputsOf } from '../../sales/saleDraft'
import type { SaleDraftApi } from '../../sales/useSaleDraft'
import type { Variety } from '../Variedades'

const TEXT = SALES_TEXT.newSale
const MINUS = '−'

interface NuevaVentaProductosProps {
  products: readonly Variety[] | null
  productsForDate: boolean
  settings: PricingSettings | null
  mostSoldIds: readonly number[] | null
  failed: Error | null
  /** The sale's Customer type id, `null` for none, or `'pending'` while the Customer read is in flight
   * and only then: the parent maps a failed Customer read, the list never decides what it means. */
  customerTypeId: number | null | 'pending'
  draft: SaleDraftApi
}

export default function NuevaVentaProductos(props: NuevaVentaProductosProps) {
  const { products, productsForDate, settings, mostSoldIds, failed, customerTypeId, draft } = props
  const { t } = useTranslation()
  const money = useMoney()
  const stockQuery = useQuery({ queryKey: keys.stock(), queryFn: readStock })
  const lines = draft.state.lines
  const [query, setQuery] = useState('')
  const searching = query.trim() !== ''

  const ready =
    products !== null &&
    settings !== null &&
    mostSoldIds !== null &&
    productsForDate &&
    failed === null &&
    customerTypeId !== 'pending'

  const sale = useMemo(() => {
    if (!ready) return null
    return priceSale({
      lines: saleLineInputsOf(lines),
      customerTypeId,
      pricingSettings: settings,
      products,
      shippingCharged: 0,
    })
  }, [ready, lines, customerTypeId, settings, products])

  const mostSold = useMemo(
    () =>
      ready
        ? mostSoldRows(
            mostSoldIds,
            products,
            lines.map((line) => line.productId),
            MOST_SOLD_ROWS,
          )
        : [],
    [ready, mostSoldIds, products, lines],
  )

  const rows = useMemo(
    () =>
      ready
        ? rowPrices({ productIds: mostSold, products, customerTypeId, pricingSettings: settings })
        : new Map<number, LinePricing | null>(),
    [ready, mostSold, products, customerTypeId, settings],
  )

  const inSale = useMemo(() => new Set(lines.map((line) => line.productId)), [lines])

  /** A result's "+" turns into its stepper in place: focus follows to the stepper's "+", or a keyboard or
   * screen reader loses its place. */
  const rowNodes = useRef(new Map<number, HTMLLIElement>())
  const focusAfterAdd = useRef<number | null>(null)
  useEffect(() => {
    const id = focusAfterAdd.current
    if (id === null || !inSale.has(id)) return
    focusAfterAdd.current = null
    const buttons = rowNodes.current.get(id)?.querySelectorAll('button')
    buttons?.[buttons.length - 1]?.focus()
  }, [inSale])

  const matches = useMemo(() => {
    if (!ready || !searching) return []
    return products
      .filter((product) => matchesQuery(product.name, query))
      .sort((a, b) => {
        const [x, y] = [foldForSearch(a.name), foldForSearch(b.name)]
        if (x !== y) return x < y ? -1 : 1
        if (a.name !== b.name) return a.name < b.name ? -1 : 1
        return a.id - b.id
      })
  }, [ready, searching, products, query])

  const matchPrices = useMemo(
    () =>
      ready
        ? rowPrices({
            productIds: matches.filter((product) => !inSale.has(product.id)).map((product) => product.id),
            products,
            customerTypeId,
            pricingSettings: settings,
          })
        : new Map<number, LinePricing | null>(),
    [ready, matches, inSale, products, customerTypeId, settings],
  )

  const field = (
    <label className="campo">
      <span className="visualmente-oculto">{TEXT.productSearchLabel}</span>
      <input
        className="campo__input nv-productos__buscar"
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        placeholder={TEXT.productSearchPlaceholder}
        value={query}
        onChange={(event) => {
          focusAfterAdd.current = null
          setQuery(event.target.value)
        }}
      />
    </label>
  )

  if (!ready || sale === null) return <div className="nv-productos">{field}</div>

  const byId = new Map(products.map((product) => [product.id, product]))
  const pricedLines = new Map(sale.lines.map((line) => [line.id, line.pricing]))
  const stockOf = new Map((stockQuery.data?.products ?? []).map((row) => [row.product_id, row.quantity]))
  const hint = nothingSellable(products)

  function stockText(productId: number): string | null {
    const quantity = stockOf.get(productId)
    return quantity === undefined ? null : TEXT.productStock(formatQuantity(signedHundredthsOfApiGrams(quantity)))
  }

  function priceCell(pricing: LinePricing | null | undefined) {
    return (
      <span className="nv-productos__precio cifra-n">
        {pricing === null || pricing === undefined ? TEXT.productNoPrice : money.money(pricing.pricePerGram)}
      </span>
    )
  }

  function nameCell(name: string, known: boolean) {
    const range = searching && known ? matchRange(name, query) : null
    if (range === null) return name
    return (
      <>
        {name.slice(0, range[0])}
        <mark className="nv-productos__marca">{name.slice(range[0], range[1])}</mark>
        {name.slice(range[1])}
      </>
    )
  }

  function datos(name: string, productId: number, known: boolean) {
    const stock = known ? stockText(productId) : null
    return (
      <span className="nv-productos__datos">
        <span className="nv-productos__nombre">{nameCell(name, known)}</span>
        {stock === null ? null : <span className="nv-productos__stock">{stock}</span>}
      </span>
    )
  }

  function lineRow(productId: number, product: Variety | undefined) {
    const name = product === undefined ? t('common:noLongerAvailable') : product.name
    const line = lines.find((candidate) => candidate.productId === productId)
    if (line === undefined) return null
    const pricing = pricedLines.get(String(productId))
    return (
      <li
        key={productId}
        ref={(node) => {
          if (node === null) rowNodes.current.delete(productId)
          else rowNodes.current.set(productId, node)
        }}
        className="nv-productos__fila"
      >
        {datos(name, productId, product !== undefined)}
        {priceCell(pricing)}
        <div role="group" aria-label={name} className="nv-productos__pasos">
          <span className="nv-productos__paso">
            <Boton variant="row" ariaLabel={TEXT.productDecrease(name)} onClick={() => draft.stepDown(productId)}>
              <span aria-hidden="true">{MINUS}</span>
            </Boton>
          </span>
          <span className="nv-productos__cantidad cifra-n">{formatQuantity(line.quantityHundredths)}</span>
          {pricing === null || pricing === undefined ? (
            <span className="nv-productos__paso-vacio" aria-hidden="true" />
          ) : (
            <span className="nv-productos__paso">
              <Boton variant="row" ariaLabel={TEXT.productIncrease(name)} onClick={() => draft.stepUp(productId)}>
                <span aria-hidden="true">+</span>
              </Boton>
            </span>
          )}
        </div>
      </li>
    )
  }

  function add(productId: number) {
    if (searching) focusAfterAdd.current = productId
    draft.addProduct(productId)
  }

  function addRow(product: Variety, pricing: LinePricing | null | undefined) {
    return (
      <li
        key={product.id}
        ref={(node) => {
          if (node === null) rowNodes.current.delete(product.id)
          else rowNodes.current.set(product.id, node)
        }}
        className="nv-productos__fila"
      >
        {datos(product.name, product.id, true)}
        {priceCell(pricing)}
        {pricing === null || pricing === undefined ? null : (
          <span className="nv-productos__paso">
            <Boton variant="row" ariaLabel={TEXT.productAdd(product.name)} onClick={() => add(product.id)}>
              <span aria-hidden="true">+</span>
            </Boton>
          </span>
        )}
      </li>
    )
  }

  const results = (
    <section className="nv-productos__seccion" aria-label={TEXT.productsResults(matches.length)}>
      <h2 className="nv-productos__titulo">{TEXT.productsResults(matches.length)}</h2>
      {matches.length === 0 ? null : (
        <ul className="nv-productos__lista">
          {matches.map((product) =>
            inSale.has(product.id) ? lineRow(product.id, product) : addRow(product, matchPrices.get(product.id)),
          )}
        </ul>
      )}
    </section>
  )

  const sections = (
    <>
      {hint === null ? null : (
        <p className="pie nueva-venta__sin-vendible">
          <span className="aviso-ambar__icono">
            <Icono nombre="atencion" />
          </span>
          <span>{hint === 'noProducts' ? t('emptyStates:selectorNoVarieties') : NO_PRICE_HINT}</span>
        </p>
      )}
      {lines.length === 0 ? null : (
        <section className="nv-productos__seccion" aria-label={TEXT.productsInSale(lines.length)}>
          <h2 className="nv-productos__titulo">{TEXT.productsInSale(lines.length)}</h2>
          <ul className="nv-productos__lista">{lines.map((line) => lineRow(line.productId, byId.get(line.productId)))}</ul>
        </section>
      )}
      {mostSold.length === 0 ? null : (
        <section className="nv-productos__seccion" aria-label={TEXT.productsMostSold}>
          <h2 className="nv-productos__titulo">{TEXT.productsMostSold}</h2>
          <ul className="nv-productos__lista">
            {mostSold.flatMap((id) => {
              const product = byId.get(id)
              return product === undefined ? [] : [addRow(product, rows.get(id))]
            })}
          </ul>
        </section>
      )}
    </>
  )

  return (
    <div className="nv-productos">
      {field}
      {searching ? results : sections}
    </div>
  )
}
