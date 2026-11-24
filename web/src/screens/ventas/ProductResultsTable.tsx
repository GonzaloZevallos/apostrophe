/**
 * The computer register's Product results table (`docs/product/sale-in-progress.md`, "Tabla de
 * resultados de Products de la computadora"): a search box and a grid of Products with the price
 * each would be sold at. Not mounted by any route until the flip part of GH-496
 * (`architecture/productResultsUnrouted.test.ts` guards it).
 *
 * Every figure is `productRows.pricedRows`'s and the order is `productRows.visibleRows`'s; this
 * component names no pricing function and computes no money. The Stock figure is the phone list's
 * call (`formatQuantity(signedHundredthsOfApiGrams(...))`). The body is one of: the failure line
 * (any of the three reads failed, Stock included, unlike the phone), the loading line, "No products
 * yet.", "No product matches that search." or the rows. No state clears the Sale in progress, and
 * nothing here re-reads a failed read.
 *
 * The keyboard stays in the search box: the arrows move the selection (held as a Product id,
 * resolved at render so a re-price or a new answer never leaves it on a missing row), Enter adds
 * the selected priced Product, Escape clears the text. An Add button does what Enter does on its
 * row and hands the focus back to the search box.
 */

import { useQuery } from '@tanstack/react-query'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type Ref,
} from 'react'
import { useTranslation } from 'react-i18next'
import type { Status } from '../../api/stock'
import { AvisoCuerpo } from '../../components/AvisoAmbar'
import { EMPTY_STATE_KEYS } from '../../copy/emptyStates'
import { SALE_PRODUCT_TABLE_TEXT as TEXT } from '../../copy/sales'
import { formatQuantity } from '../../format/money'
import { useMoney } from '../../format/moneyContext'
import { signedHundredthsOfApiGrams } from '../../sales/pricing'
import { pricedRows, visibleRows } from '../../sales/productRows'
import {
  pricingSettingsOf,
  saleFormPricingSettingsQuery,
  saleFormProductsQuery,
  saleFormStockQuery,
} from '../../sales/saleFormQueries'
import type { SaleDraftApi } from '../../sales/useSaleDraft'
import './ProductResultsTable.css'

interface ProductResultsTableProps {
  draft: SaleDraftApi
  customerTypeId: number | null
}

type ResultRowProps = ComponentPropsWithoutRef<'tr'> & { rowRef: Ref<HTMLTableRowElement> | undefined }

/** A grid row: a click selects it and a mouse down never takes the focus from the search box. */
function ResultRow({ rowRef, ...rest }: ResultRowProps) {
  return <tr ref={rowRef} role="row" className="prt__row" {...rest} />
}

/** The word a Stock status adds after the figure; `ok` adds none. Exhaustive over `Status`. */
function stockWord(status: Status): string | null {
  switch (status) {
    case 'no_entries':
      return TEXT.statusNoEntries
    case 'sold_out':
      return TEXT.statusSoldOut
    case 'low':
      return TEXT.statusLow
    case 'ok':
      return null
  }
  const unreachable: never = status
  return unreachable
}

export default function ProductResultsTable({ draft, customerTypeId }: ProductResultsTableProps) {
  const money = useMoney()
  const { t } = useTranslation()
  const gridId = useId()
  const labelId = useId()
  const date = draft.state.date
  const productsRead = useQuery(saleFormProductsQuery(date))
  const settingsRead = useQuery(saleFormPricingSettingsQuery(date))
  const stockRead = useQuery(saleFormStockQuery())
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedRowRef = useRef<HTMLTableRowElement>(null)

  useEffect(() => inputRef.current?.focus(), [])

  const failed = productsRead.isError || settingsRead.isError || stockRead.isError
  const loading =
    productsRead.isPending ||
    settingsRead.isPending ||
    stockRead.isPending ||
    productsRead.isPlaceholderData ||
    settingsRead.isPlaceholderData
  const products = failed || loading ? undefined : productsRead.data
  const settings = failed || loading ? undefined : settingsRead.data
  const stock = failed || loading ? undefined : stockRead.data

  const priced = useMemo(
    () =>
      products === undefined || settings === undefined || stock === undefined
        ? []
        : pricedRows({
            products,
            stock: stock.products,
            draft: draft.state,
            customerTypeId,
            pricingSettings: pricingSettingsOf(settings),
          }),
    [products, settings, stock, draft.state, customerTypeId],
  )
  const visible = useMemo(() => visibleRows(priced, query), [priced, query])

  const body = failed
    ? 'failed'
    : loading
      ? 'loading'
      : priced.length === 0
        ? 'empty'
        : visible.length === 0
          ? 'noMatch'
          : 'rows'
  const shown = body === 'rows' ? visible : []

  const selected = shown.find((row) => row.id === selectedId) ?? shown[0] ?? null
  const activeId = selected?.id ?? null
  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  /** The one add: Enter and an Add click both come here. A No price row adds nothing. */
  function addRow(row: (typeof priced)[number]) {
    if (row.pricing === null) return
    draft.addProduct(row.id)
    setQuery('')
    setSelectedId(null)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (selected === null) return
      const at = shown.indexOf(selected)
      const next = shown[event.key === 'ArrowDown' ? Math.min(at + 1, shown.length - 1) : Math.max(at - 1, 0)]
      if (next !== undefined) setSelectedId(next.id)
    } else if (event.key === 'Enter') {
      if (selected === null || selected.pricing === null) return
      event.preventDefault()
      addRow(selected)
    } else if (event.key === 'Escape') {
      if (query === '') return
      event.preventDefault()
      event.stopPropagation()
      setQuery('')
      setSelectedId(null)
    }
  }

  return (
    <div className="prt">
      <label className="prt__label">
        <span id={labelId} className="visualmente-oculto">
          {TEXT.searchLabel}
        </span>
        <input
          ref={inputRef}
          className="prt__search"
          role="combobox"
          type="text"
          autoComplete="off"
          aria-expanded="true"
          aria-controls={gridId}
          aria-activedescendant={activeId === null ? undefined : `${gridId}-${activeId}`}
          aria-labelledby={labelId}
          placeholder={TEXT.searchPlaceholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setSelectedId(null)
          }}
          onKeyDown={onKeyDown}
        />
      </label>
      <table id={gridId} className="prt__grid" role="grid" aria-labelledby={labelId} aria-busy={loading}>
        <thead>
          <tr role="row">
            <th role="columnheader" scope="col" className="prt__head">
              {TEXT.columnProduct}
            </th>
            <th role="columnheader" scope="col" className="prt__head prt__head--stock">
              {TEXT.columnStock}
            </th>
            <th role="columnheader" scope="col" className="prt__head prt__head--price">
              {TEXT.columnPrice}
            </th>
            <th role="columnheader" scope="col" className="prt__head visualmente-oculto">
              {TEXT.columnAdd}
            </th>
          </tr>
        </thead>
        <tbody>
          {body === 'failed' ? (
            <tr role="row">
              <td role="gridcell" colSpan={4} className="prt__state prt__state--failed">
                <AvisoCuerpo attention>{TEXT.failed}</AvisoCuerpo>
              </td>
            </tr>
          ) : null}
          {body === 'loading' ? (
            <tr role="row">
              <td role="gridcell" colSpan={4} className="prt__loading">
                {TEXT.loading}
              </td>
            </tr>
          ) : null}
          {body === 'empty' ? (
            <tr role="row">
              <td role="gridcell" colSpan={4} className="prt__state">
                {t(EMPTY_STATE_KEYS.productResultsEmpty)}
              </td>
            </tr>
          ) : null}
          {body === 'noMatch' ? (
            <tr role="row">
              <td role="gridcell" colSpan={4} className="prt__state">
                {t(EMPTY_STATE_KEYS.productResultsNoMatch)}
              </td>
            </tr>
          ) : null}
          {shown.map((row) => {
            const isSelected = row.id === activeId
            const word = row.stock === null ? null : stockWord(row.stock.status)
            return (
              <ResultRow
                key={row.id}
                id={`${gridId}-${row.id}`}
                rowRef={isSelected ? selectedRowRef : undefined}
                aria-selected={isSelected}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setSelectedId(row.id)}
              >
                <td role="gridcell" className="prt__cell prt__cell--name">
                  {isSelected ? <span className="prt__mark" aria-hidden="true" /> : null}
                  <span className="prt__name">{row.name}</span>
                </td>
                <td role="gridcell" className="prt__cell prt__cell--stock cifra-n">
                  {row.stock === null ? null : formatQuantity(signedHundredthsOfApiGrams(row.stock.quantity))}
                  {word === null ? null : <span className="prt__word">{word}</span>}
                </td>
                <td role="gridcell" className="prt__cell prt__cell--price cifra-n">
                  {row.pricing === null ? TEXT.noPrice : money.money(row.pricing.pricePerGram)}
                </td>
                <td role="gridcell" className="prt__cell prt__cell--add">
                  <button
                    type="button"
                    className="prt__add"
                    tabIndex={-1}
                    aria-label={TEXT.addProduct(row.name)}
                    disabled={row.pricing === null}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => {
                      event.stopPropagation()
                      addRow(row)
                      inputRef.current?.focus()
                    }}
                  >
                    <span aria-hidden="true">+</span>
                  </button>
                </td>
              </ResultRow>
            )
          })}
        </tbody>
      </table>
      <p className="prt__help">{TEXT.helpLine}</p>
    </div>
  )
}
