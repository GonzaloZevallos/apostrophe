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
 * What shows is decided by `status` (`useNewSaleReads`) alone: `loading` is `MOST_SOLD_ROWS` skeleton
 * rows with no text, `refreshing` (and a `'pending'` Customer) keeps the names and the line steppers
 * and puts the compact loading mark where a price goes, `failed` is SinConexion for a `NetworkError`
 * and ErrorGenerico for any other error, and `ready` is the list. `priceSale` and `rowPrices` run on
 * no other render. The busy state goes through `LoadingWhile` on the screen's `ContentArea`, which
 * the list counts on and never renders. No state here reads or writes the draft's lines.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { NetworkError } from '../../api/client'
import Boton from '../../components/Boton'
import ErrorGenerico from '../../components/ErrorGenerico'
import Icono from '../../components/Icono'
import Loading, { LoadingWhile } from '../../components/Loading'
import SinConexion from '../../components/SinConexion'
import { formatQuantity } from '../../format/money'
import { useMoney } from '../../format/moneyContext'
import { NO_PRICE_HINT, SALES_TEXT } from '../../copy/sales'
import { nothingSellable } from '../../sales/nothingSellable'
import {
  priceSale,
  rowPrices,
  signedHundredthsOfApiGrams,
  type LinePricing,
} from '../../sales/pricing'
import { MOST_SOLD_ROWS, mostSoldRows } from '../../sales/productList'
import { saleLineInputsOf } from '../../sales/saleDraft'
import type { NewSaleReads } from '../../sales/useNewSaleReads'
import type { SaleDraftApi } from '../../sales/useSaleDraft'

const TEXT = SALES_TEXT.newSale
const MINUS = '−'

interface NuevaVentaProductosProps extends Pick<NewSaleReads, 'status' | 'products' | 'settings' | 'mostSoldIds' | 'stock' | 'failed'> {
  /** The sale's Customer type id, `null` for none, or `'pending'` while the Customer read is in flight
   * and only then: the parent maps a failed Customer read, the list never decides what it means. */
  customerTypeId: number | null | 'pending'
  draft: SaleDraftApi
}

export default function NuevaVentaProductos(props: NuevaVentaProductosProps) {
  const { status, products, settings, mostSoldIds, stock, failed, customerTypeId, draft } = props
  const { t } = useTranslation()
  const money = useMoney()
  const lines = draft.state.lines

  // The one condition under which a figure is priced: every read is in for the sale's date and the
  // Customer is known. `pending` stands for the marks, whatever the status was.
  const ready =
    status === 'ready' &&
    products !== null &&
    settings !== null &&
    mostSoldIds !== null &&
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

  // The names and steppers of a loaded list stay while the date's figures come: which Most sold rows
  // there are depends on ids only, never on a price.
  const listed =
    (status === 'ready' || status === 'refreshing') && products !== null && mostSoldIds !== null
  const mostSold = useMemo(
    () =>
      listed
        ? mostSoldRows(
            mostSoldIds,
            products,
            lines.map((line) => line.productId),
            MOST_SOLD_ROWS,
          )
        : [],
    [listed, mostSoldIds, products, lines],
  )

  const rows = useMemo(
    () =>
      ready
        ? rowPrices({ productIds: mostSold, products, customerTypeId, pricingSettings: settings })
        : new Map<number, LinePricing | null>(),
    [ready, mostSold, products, customerTypeId, settings],
  )

  if (status === 'failed') return failed instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />

  if (!listed) {
    return (
      <div className="nv-productos">
        <LoadingWhile active />
        <ul className="nv-productos__lista">
          {Array.from({ length: MOST_SOLD_ROWS }, (_, index) => (
            <li key={index} className="nv-productos__fila nv-productos__fila--esqueleto" aria-hidden="true">
              <span className="cargando__barra cargando__barra--corta" />
              <span className="cargando__barra cargando__barra--corta" />
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const byId = new Map(products.map((product) => [product.id, product]))
  const pricedLines = new Map((sale?.lines ?? []).map((line) => [line.id, line.pricing]))
  const stockOf = new Map((stock ?? []).map((row) => [row.product_id, row.quantity]))
  const hint = ready ? nothingSellable(products) : null

  function stockText(productId: number): string | null {
    const quantity = stockOf.get(productId)
    return quantity === undefined ? null : TEXT.productStock(formatQuantity(signedHundredthsOfApiGrams(quantity)))
  }

  function priceCell(pricing: LinePricing | null | undefined) {
    return (
      <span className="nv-productos__precio cifra-n">
        {!ready ? (
          <Loading compacto />
        ) : pricing === null || pricing === undefined ? (
          TEXT.productNoPrice
        ) : (
          money.money(pricing.pricePerGram)
        )}
      </span>
    )
  }

  function datos(name: string, productId: number, known: boolean) {
    const stockLabel = known ? stockText(productId) : null
    return (
      <span className="nv-productos__datos">
        <span className="nv-productos__nombre">{name}</span>
        {stockLabel === null ? null : <span className="nv-productos__stock">{stockLabel}</span>}
      </span>
    )
  }

  return (
    <div className="nv-productos">
      <LoadingWhile active={!ready} />
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
              // While the figures come, the "+" stays: the stepper keeps working and the read decides
              // afterwards whether the line still has a price.
              const unpriced = ready && (pricing === null || pricing === undefined)
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
                    {unpriced ? (
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
                  {!ready || pricing === null || pricing === undefined ? null : (
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
