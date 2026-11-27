/** The model of one row in the phone Products Catalog view: price line, hint, badge, hidden and the accessible name. Pure: types only. */

import type { TFunction } from 'i18next'
import type { MoneyAmount, MoneyFormatter } from '../../format/money'

export type CatalogRowStatus = 'no_entries' | 'sold_out' | 'low' | 'ok'

export interface CatalogRowInput {
  name: string
  currentPrice: { list_price: MoneyAmount; bulk_price: MoneyAmount | null } | null
  isBulkPricing: boolean
  /** From GET /stock; undefined when /stock has no row for the product. */
  status?: CatalogRowStatus
  hidden: boolean
}

export interface CatalogRowModel {
  priceLine: string
  hint: string | null
  badge: 'sold_out' | 'low' | null
  hidden: boolean
  accessibleName: string
}

function priceLineOf(input: CatalogRowInput, money: MoneyFormatter, t: TFunction): string {
  const price = input.currentPrice
  if (price === null) return t('products:row.noPrice')
  const base = t('common:pricePerGram', { amount: money.money(price.list_price) })
  if (!input.isBulkPricing || price.bulk_price === null) return base
  return base + t('products:row.bulk', { amount: money.money(price.bulk_price) })
}

function badgeOf(status: CatalogRowStatus | undefined): CatalogRowModel['badge'] {
  return status === 'sold_out' || status === 'low' ? status : null
}

export function catalogRow(input: CatalogRowInput, money: MoneyFormatter, t: TFunction): CatalogRowModel {
  const priceLine = priceLineOf(input, money, t)
  const hint = input.currentPrice === null ? t('products:row.noPriceHint') : null
  const badge = badgeOf(input.status)
  const tail: string[] = [priceLine]
  if (hint !== null) tail.push(hint)
  if (badge !== null) tail.push(badge === 'sold_out' ? t('products:badge.soldOut') : t('products:badge.low'))
  if (input.hidden) tail.push(t('products:row.hidden'))
  // The key's placeholders are the registered ones: `name` takes what comes first, `items` what follows.
  const joined = tail.reduce((first, rest) => t('products:row.a11yName', { name: first, items: rest }))
  return {
    priceLine,
    hint,
    badge,
    hidden: input.hidden,
    // The name joins last, in one call, so its text is a value and never a template.
    accessibleName: t('products:row.a11yName', { name: input.name, items: joined }),
  }
}
