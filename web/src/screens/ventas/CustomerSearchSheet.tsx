/**
 * New sale's customer search Sheet (`customer-search.md`): "Choose a customer" over the sale, with
 * the Recent customers of an empty query and the matches of a typed one. Nothing mounts it yet; the
 * flip part of GH-496 does.
 *
 * - The parent mounts the Sheet only while its history entry exists, so the query survives Create
 *   (the Create customer sheet is a second entry over this one, and this Sheet stays mounted
 *   beneath it) and is empty on the next opening.
 * - A customer saved from Create shows only on the next opening (the customers are read once per
 *   opening): the parent chooses the new customer itself and closes the Sheet.
 * - The Sheet raises `onCreate(query)` and mounts no Create form; it holds no part of the sale.
 * - Loading and failure states arrive in GH-1013: until then a pending or failed read shows no rows,
 *   no heading and no no-match line, and Create and No customer stay.
 * - The level comes from `SheetLevel` only: Close is the entry at `level + 1`, and while the entry
 *   over this one is open everything here is `inert`; when it closes, focus returns to the field.
 * - Matching, recent resolution and highlight come only from `sales/customerSearch.ts`.
 */

import { useQuery } from '@tanstack/react-query'
import { useContext, useEffect, useId, useRef, useState } from 'react'
import { type Customer, listCustomers } from '../../api/customers'
import { keys } from '../../api/keys'
import Boton from '../../components/Boton'
import Icono from '../../components/Icono'
import { SheetLevel, useSheet } from '../../components/useSheetStack'
import { SALES_TEXT } from '../../copy/sales'
import { highlightRanges, matchCustomers, RECENT_ROWS, resolveRecent } from '../../sales/customerSearch'

const TEXT = SALES_TEXT.customerSearch

export interface CustomerSearchSheetProps {
  onChoose: (customer: Customer) => void
  onContinueWithout: () => void
  onCreate: (query: string) => void
  /** The seller's recent customers' ids, newest first; `loading` shows no Recent block yet. */
  recent: { status: 'loading' | 'ready'; ids: number[] }
}

/** `text` with the `[start, end)` range in a `<mark>`; the range comes from `customerSearch.ts`. */
function Highlighted({ text, range }: { text: string; range: [number, number] | null }) {
  if (range === null) return <>{text}</>
  return (
    <>
      {text.slice(0, range[0])}
      <mark className="customer-search__mark">{text.slice(range[0], range[1])}</mark>
      {text.slice(range[1])}
    </>
  )
}

function CustomerRow({ customer, query, onChoose }: { customer: Customer; query: string; onChoose: (customer: Customer) => void }) {
  return (
    <Boton variant="row" onClick={() => onChoose(customer)}>
      <span className="customer-search__name">
        <Highlighted text={customer.name} range={highlightRanges(customer.name, query, 'name')} />
      </span>
      {customer.phone_display !== null && (
        <span className="customer-search__phone">
          <Highlighted text={customer.phone_display} range={highlightRanges(customer.phone_display, query, 'phone')} />
        </span>
      )}
    </Boton>
  )
}

export default function CustomerSearchSheet({ onChoose, onContinueWithout, onCreate, recent }: CustomerSearchSheetProps) {
  const level = useContext(SheetLevel)
  const closer = useSheet(level + 1)
  const covered = useSheet(level + 2).isOpen
  const [query, setQuery] = useState('')
  const field = useRef<HTMLInputElement>(null)
  const wasCovered = useRef(false)
  const hintId = useId()

  const read = useQuery({
    queryKey: keys.saleFormCustomers(),
    queryFn: () => listCustomers(''),
    gcTime: 0,
    staleTime: Infinity,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  useEffect(() => {
    field.current?.focus({ preventScroll: true })
  }, [])
  useEffect(() => {
    if (wasCovered.current && !covered) field.current?.focus({ preventScroll: true })
    wasCovered.current = covered
  }, [covered])

  const typed = query.trim() !== ''
  const customers = read.isSuccess ? read.data : null
  let rows: Customer[] = []
  if (customers !== null) {
    if (typed) rows = matchCustomers(customers, query)
    else if (recent.status === 'ready') rows = resolveRecent(customers, recent.ids, RECENT_ROWS)
  }
  const noMatch = typed && customers !== null && rows.length === 0
  const trimmed = query.trim()

  return (
    <SheetLevel.Provider value={level + 1}>
      <div className="customer-search" role="dialog" aria-modal="true" aria-label={TEXT.sheetName}>
        <div className="customer-search__content" inert={covered}>
          <span className="customer-search__handle" aria-hidden="true" />
          <div className="customer-search__header">
            <span className="panel__titulo">{TEXT.title}</span>
            <Boton variant="icon" action="close" ariaLabel={TEXT.close} onClick={closer.close} />
          </div>
          <label className="campo campo--buscar">
            <span className="campo__rotulo visualmente-oculto">{TEXT.searchLabel}</span>
            <span className="campo--buscar__icono">
              <Icono nombre="buscar" />
            </span>
            <input
              ref={field}
              className="campo__input campo--buscar__input"
              type="search"
              autoComplete="off"
              enterKeyHint="search"
              aria-describedby={hintId}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.preventDefault()
              }}
            />
          </label>
          <p id={hintId} className="customer-search__hint">
            {TEXT.hint}
          </p>
          <div className="customer-search__list">
            {!typed && rows.length > 0 && <h2 className="customer-search__heading">{TEXT.recentHeading}</h2>}
            {rows.map((customer) => (
              <CustomerRow key={customer.id} customer={customer} query={query} onChoose={onChoose} />
            ))}
            {noMatch && <p className="customer-search__no-match">{TEXT.noMatch(trimmed)}</p>}
            {typed && (
              <Boton variant="secondary" icon="personaMas" ariaLabel={TEXT.createName(trimmed)} onClick={() => onCreate(trimmed)}>
                <span className="customer-search__create">{TEXT.create(trimmed)}</span>
              </Boton>
            )}
            <Boton variant="secondary" icon="clientes" ariaLabel={TEXT.noneName} onClick={onContinueWithout}>
              {TEXT.none}
            </Boton>
          </div>
        </div>
      </div>
    </SheetLevel.Provider>
  )
}
