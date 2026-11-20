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
 * Until the search and the loading and failure states land in their own parts, one guard decides: while
 * any read is pending, a date's Products are not in, a read failed or the Customer is `'pending'`,
 * the list renders nothing (no stand-in UI). The draft keeps every line meanwhile.
 */

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { keys } from '../../api/keys'
import { readStock } from '../../api/stock'
import Boton from '../../components/Boton'
import Icono from '../../components/Icono'
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

  if (!ready || sale === null) return null

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

  function datos(name: string, productId: number, known: boolean) {
    const stock = known ? stockText(productId) : null
    return (
      <span className="nv-productos__datos">
        <span className="nv-productos__nombre">{name}</span>
        {stock === null ? null : <span className="nv-productos__stock">{stock}</span>}
      </span>
    )
  }

  return (
    <div className="nv-productos">
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
          <ul className="nv-productos__lista">
            {lines.map((line) => {
              const product = byId.get(line.productId)
              const name = product === undefined ? t('common:noLongerAvailable') : product.name
              const pricing = pricedLines.get(String(line.productId))
              return (
                <li key={line.productId} className="nv-productos__fila">
                  {datos(name, line.productId, product !== undefined)}
                  {priceCell(pricing)}
                  <div role="group" aria-label={name} className="nv-productos__pasos">
                    <span className="nv-productos__paso">
                      <Boton variant="row" ariaLabel={TEXT.productDecrease(name)} onClick={() => draft.stepDown(line.productId)}>
                        <span aria-hidden="true">{MINUS}</span>
                      </Boton>
                    </span>
                    <span className="nv-productos__cantidad cifra-n">{formatQuantity(line.quantityHundredths)}</span>
                    {pricing === null || pricing === undefined ? (
                      <span className="nv-productos__paso-vacio" aria-hidden="true" />
                    ) : (
                      <span className="nv-productos__paso">
                        <Boton variant="row" ariaLabel={TEXT.productIncrease(name)} onClick={() => draft.stepUp(line.productId)}>
                          <span aria-hidden="true">+</span>
                        </Boton>
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      {mostSold.length === 0 ? null : (
        <section className="nv-productos__seccion" aria-label={TEXT.productsMostSold}>
          <h2 className="nv-productos__titulo">{TEXT.productsMostSold}</h2>
          <ul className="nv-productos__lista">
            {mostSold.flatMap((id) => {
              const product = byId.get(id)
              if (product === undefined) return []
              const pricing = rows.get(id)
              return [
                <li key={id} className="nv-productos__fila">
                  {datos(product.name, id, true)}
                  {priceCell(pricing)}
                  {pricing === null || pricing === undefined ? null : (
                    <span className="nv-productos__paso">
                      <Boton variant="row" ariaLabel={TEXT.productAdd(product.name)} onClick={() => draft.addProduct(id)}>
                        <span aria-hidden="true">+</span>
                      </Boton>
                    </span>
                  )}
                </li>,
              ]
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
