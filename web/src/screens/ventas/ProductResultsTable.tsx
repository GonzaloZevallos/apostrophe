/**
 * The computer register's Product results table (`docs/product/sale-in-progress.md`, "Tabla de
 * resultados de Products de la computadora"): a search box and a grid of Products with the price
 * each would be sold at. Not mounted by any route until the flip part of GH-496
 * (`architecture/productResultsUnrouted.test.ts` guards it).
 *
 * Every figure is `productRows.pricedRows`'s and the order is `productRows.visibleRows`'s; this
 * component names no pricing function and computes no money. The Stock column, the Add buttons and
 * the failure, no-products and no-match lines belong to GH-1034: here a failed read, an empty list
 * and a search with no match render no body rows and no text.
 *
 * The keyboard stays in the search box: the arrows move the selection (held as a Product id,
 * resolved at render so a re-price or a new answer never leaves it on a missing row), Enter adds
 * the selected priced Product, Escape clears the text.
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
import { SALE_PRODUCT_TABLE_TEXT as TEXT } from '../../copy/sales'
import { useMoney } from '../../format/moneyContext'
import { pricedRows, visibleRows } from '../../sales/productRows'
import {
  pricingSettingsOf,
  saleFormPricingSettingsQuery,
  saleFormProductsQuery,
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

export default function ProductResultsTable({ draft, customerTypeId }: ProductResultsTableProps) {
  const money = useMoney()
  const gridId = useId()
  const labelId = useId()
  const date = draft.state.date
  const productsRead = useQuery(saleFormProductsQuery(date))
  const settingsRead = useQuery(saleFormPricingSettingsQuery(date))
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedRowRef = useRef<HTMLTableRowElement>(null)

  useEffect(() => inputRef.current?.focus(), [])

  const failed = productsRead.isError || settingsRead.isError
  const loading =
    productsRead.isPending ||
    settingsRead.isPending ||
    productsRead.isPlaceholderData ||
    settingsRead.isPlaceholderData
  const products = failed || loading ? undefined : productsRead.data
  const settings = failed || loading ? undefined : settingsRead.data

  const priced = useMemo(
    () =>
      products === undefined || settings === undefined
        ? []
        : pricedRows({
            products,
            stock: [],
            draft: draft.state,
            customerTypeId,
            pricingSettings: pricingSettingsOf(settings),
          }),
    [products, settings, draft.state, customerTypeId],
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
      draft.addProduct(selected.id)
      setQuery('')
      setSelectedId(null)
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
      <table id={gridId} className="prt__grid" role="grid" aria-labelledby={labelId} aria-busy={body === 'loading'}>
        <thead>
          <tr role="row">
            <th role="columnheader" scope="col" className="prt__head">
              {TEXT.columnProduct}
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
          {body === 'loading' ? (
            <tr role="row">
              <td role="gridcell" colSpan={3} className="prt__loading">
                {TEXT.loading}
              </td>
            </tr>
          ) : null}
          {shown.map((row) => {
            const isSelected = row.id === activeId
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
                <td role="gridcell" className="prt__cell prt__cell--price cifra-n">
                  {row.pricing === null ? TEXT.noPrice : money.money(row.pricing.pricePerGram)}
                </td>
                <td role="gridcell" className="prt__cell" />
              </ResultRow>
            )
          })}
        </tbody>
      </table>
      <p className="prt__help">{TEXT.helpLine}</p>
    </div>
  )
}
