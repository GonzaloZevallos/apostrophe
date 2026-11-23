/**
 * New sale's price source, called once by whoever hosts the Sheet (`NewSaleSheetHost`, and the Sheet's
 * test harness): it reads (`useNewSaleReads`), runs `pricedSaleOf` once per render in a `useMemo`, and
 * keeps each product's last-known name. It never calls `priceSale`. Not mounted by any route until the
 * flip part of GH-496.
 *
 * The names map (product id to name) only grows: it is merged while rendering from each new Products
 * answer, compared by the identity of the previous answer kept in state, so a product archived mid-sale
 * (absent from the new date's answer) keeps the name its line was added under. No ref, no effect, no
 * query-cache read. `nameOf` is safe only while every draft line comes from a listed product.
 */

import { useCallback, useMemo, useState } from 'react'
import { useMoney } from '../format/moneyContext'
import type { Variety } from '../screens/Variedades'
import { type NewSalePricing, pricedSaleOf } from './newSalePricing'
import { type CustomerView, customerTypeIdOf } from './newSaleView'
import type { DraftState } from './saleDraft'
import { type NewSaleReads, useNewSaleReads } from './useNewSaleReads'

type Names = ReadonlyMap<number, string>

/** `names` with each product of `products` set to its newest name; `names` itself when nothing is added or renamed. */
function mergedNames(names: Names, products: readonly Variety[]): Names {
  const changed = products.filter((product) => names.get(product.id) !== product.name)
  if (changed.length === 0) return names
  const next = new Map(names)
  for (const product of changed) next.set(product.id, product.name)
  return next
}

export interface NewSalePriceSource {
  reads: NewSaleReads
  pricing: NewSalePricing
  /** The last-known name of a product; throws for an id no answer has listed (a data fault). */
  nameOf: (id: number) => string
}

export function useNewSalePricing({
  state,
  customer,
}: {
  state: Pick<DraftState, 'date' | 'openedOn' | 'lines' | 'shipping'>
  customer: CustomerView
}): NewSalePriceSource {
  const reads = useNewSaleReads({ date: state.date, openedOn: state.openedOn })
  const { format } = useMoney()
  const { status, products, settings, mostSoldIds } = reads
  const customerTypeId = customerTypeIdOf(customer)
  const { lines, shipping } = state
  const pricing = useMemo(
    () => pricedSaleOf({ status, products, settings, mostSoldIds, customerTypeId, lines, shipping, format }),
    [status, products, settings, mostSoldIds, customerTypeId, lines, shipping, format],
  )

  const [known, setKnown] = useState<{ from: readonly Variety[] | null; names: Names }>({
    from: null,
    names: new Map(),
  })
  let names = known.names
  if (products !== null && products !== known.from) {
    names = mergedNames(known.names, products)
    setKnown({ from: products, names })
  }
  const nameOf = useCallback(
    (id: number): string => {
      const name = names.get(id)
      if (name === undefined) throw new Error('no name for product')
      return name
    },
    [names],
  )

  return { reads, pricing, nameOf }
}
