/**
 * `NuevaVentaSheet`: the frame of New sale (drawings `NuevaVenta` and `NuevaVentaOscuro`), drawn inside
 * the shared `Sheet` as `CollectSheet` is. Not routed: no route or navigation entry mounts it until the
 * flip part of GH-496, and `front-exclude.json` lists it until then.
 *
 * It holds the Customer row at the top, New sale's Product list, and the sale bar as the last child of
 * `SheetActions`. Its host owns Escape, the system back, the Customer (a `CustomerView`, Change and
 * the choice of another one) and what happens after Collect.
 *
 * - The one price result is `pricedSaleOf`, run once per render in a `useMemo`: every figure here is
 *   read from it, this component does no money arithmetic and never calls `priceSale`.
 * - The sale bar's one state is `saleBarState`: Collect exists only in the `total` state and is never
 *   drawn disabled; in every other state there is no Collect button at all. It is a sibling of the
 *   `role="status"` region, never inside it.
 * - The Customer row's price line is `customerPriceLineOf` alone: a failed read never shows a label.
 * - The Sheet is touched exactly when the draft has a line (`isDirty`), and its Close leaves at once.
 */

import { useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Boton from '../../components/Boton'
import Loading from '../../components/Loading'
import Sheet, { SheetActions } from '../../components/Sheet'
import { SALES_TEXT } from '../../copy/sales'
import { useMoney } from '../../format/moneyContext'
import { type CompleteSale, pricedSaleOf } from '../../sales/newSalePricing'
import {
  type CustomerView,
  customerPriceLineOf,
  customerTypeIdOf,
  type PriceLine,
  saleBarState,
  type SaleBarState,
} from '../../sales/newSaleView'
import { isDirty } from '../../sales/saleDraft'
import { useNewSaleReads } from '../../sales/useNewSaleReads'
import type { SaleDraftApi } from '../../sales/useSaleDraft'
import NuevaVentaProductos from './NuevaVentaProductos'

const TEXT = SALES_TEXT.newSale

export interface NuevaVentaSheetProps {
  draft: SaleDraftApi
  customer: CustomerView
  onClose: () => void
  onChangeCustomer: () => void
  onCollect: (sale: CompleteSale) => void
  /** The Sheet frame, passed through (`computerClass` is the host's own frame on a computer). */
  computer: boolean
  computerClass: string
  computerDialog: boolean
}

/** The Customer row's first line: the name, "No customer", or the Loading mark where the name is not known. */
function nameOf(customer: CustomerView): string | null {
  switch (customer.kind) {
    case 'none':
      return SALES_TEXT.noCustomer
    case 'known':
    case 'typePending':
      return customer.name
    case 'failed':
      return customer.name
    case 'namePending':
      return null
    default: {
      const unreachable: never = customer
      return unreachable
    }
  }
}

function PriceLineText({ line }: { line: PriceLine }) {
  switch (line.kind) {
    case 'list':
      return <span className="cliente-fila__linea">{TEXT.listPrices}</span>
    case 'type':
      return <span className="cliente-fila__linea">{TEXT.pricesFor(line.name)}</span>
    case 'loading':
      return <Loading compacto />
    case 'none':
      return null
    default: {
      const unreachable: never = line
      return unreachable
    }
  }
}

/** The status region's content: the copy text, with the total's figure in a figure element that never splits. */
function BarText({ bar, lineCount, figure }: { bar: SaleBarState; lineCount: number; figure: string | null }) {
  switch (bar.kind) {
    case 'empty':
      return <>{TEXT.addProductToCollect}</>
    case 'count':
      return <>{TEXT.itemsCount(lineCount)}</>
    case 'counting':
      return (
        <>
          {TEXT.itemsCount(lineCount)}
          <Loading compacto />
        </>
      )
    case 'total': {
      const shown = figure ?? ''
      const text = TEXT.itemsTotal(bar.n, shown)
      const at = text.lastIndexOf(shown)
      return (
        <>
          {text.slice(0, at)}
          <span className="cifra-m sale-bar__cifra">{shown}</span>
          {text.slice(at + shown.length)}
        </>
      )
    }
    default: {
      const unreachable: never = bar
      return unreachable
    }
  }
}

export default function NuevaVentaSheet({
  draft,
  customer,
  onClose,
  onChangeCustomer,
  onCollect,
  computer,
  computerClass,
  computerDialog,
}: NuevaVentaSheetProps) {
  const { t } = useTranslation()
  const money = useMoney()
  const titleId = useId()
  const { state } = draft
  const reads = useNewSaleReads({ date: state.date, openedOn: state.openedOn })
  const { status, products, settings, mostSoldIds } = reads
  const customerTypeId = customerTypeIdOf(customer)
  const { lines, shipping } = state
  const format = money.format
  const pricing = useMemo(
    () => pricedSaleOf({ status, products, settings, mostSoldIds, customerTypeId, lines, shipping, format }),
    [status, products, settings, mostSoldIds, customerTypeId, lines, shipping, format],
  )
  const bar = saleBarState({ status, customer, pricing, lineCount: lines.length })
  const line = customerPriceLineOf({ customer, status, settings })
  const name = nameOf(customer)

  return (
    <Sheet
      computer={computer}
      computerClass={computerClass}
      computerDialog={computerDialog}
      titleId={titleId}
      touched={isDirty(state)}
      onClose={onClose}
    >
      <div className="encabezado-fila">
        <span id={titleId} className="panel__titulo">
          {t('common:newSale')}
        </span>
        <Boton variant="icon" action="close" ariaLabel={t('common:close')} onClick={onClose} />
      </div>
      <div className="cliente-fila">
        <div className="cliente-fila__texto">
          <span className="cliente-fila__nombre">{name ?? <Loading compacto />}</span>
          <PriceLineText line={line} />
        </div>
        <Boton variant="link" onClick={onChangeCustomer}>
          {t('common:change')}
        </Boton>
      </div>
      <NuevaVentaProductos
        {...reads}
        customerTypeId={customerTypeId}
        draft={draft}
        pricing={pricing}
      />
      <SheetActions>
        <div className="sale-bar">
          <div className="sale-bar__estado" role="status">
            <BarText
              bar={bar}
              lineCount={lines.length}
              figure={bar.kind === 'total' ? money.money(bar.sale.totals.total) : null}
            />
          </div>
          {bar.kind === 'total' && (
            <Boton textOnly="submit" type="button" onClick={() => onCollect(bar.sale)}>
              {SALES_TEXT.collectShort}
            </Boton>
          )}
        </div>
      </SheetActions>
    </Sheet>
  )
}
