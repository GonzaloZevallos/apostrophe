/**
 * Builds every TanStack Query key the front uses (plan, "Server state"): no other
 * module builds one by hand, so a resource's whole prefix is always exactly what a
 * mutation invalidates.
 */

import type { QueryClient } from '@tanstack/react-query'

export type Resource =
  | 'me'
  | 'business'
  | 'varieties'
  | 'customers'
  | 'expenses'
  | 'expenseCategories'

const PREFIX: Record<Resource, string> = {
  me: 'me',
  business: 'business',
  varieties: 'varieties',
  customers: 'customers',
  expenses: 'expenses',
  expenseCategories: 'expense-categories',
}

export const keys = {
  me: () => [PREFIX.me] as const,
  business: () => [PREFIX.business] as const,
  varieties: () => [PREFIX.varieties] as const,
  variety: (id: string) => [PREFIX.varieties, id] as const,
  varietyPrices: (id: string) => [PREFIX.varieties, id, 'prices'] as const,
  customers: (q: string) => [PREFIX.customers, { q }] as const,
  customer: (id: string) => [PREFIX.customers, id] as const,
  expenses: (month: string) => [PREFIX.expenses, month] as const,
  expenseCategories: () => [PREFIX.expenseCategories] as const,
  // `Nueva venta`'s own prices and customer-by-id fetches (plan, invariants:
  // "fetched under form-only keys (['sale-form', ...])"), deliberately outside the
  // `Resource`/`PREFIX` invalidation system above: these two queries are never
  // invalidated — frozen with `gcTime: 0, staleTime: Infinity` at the call site
  // instead — so a write to `'customers'` or `'varieties'` elsewhere in the app can
  // never mark them stale, and the form's own preview never renders a value another
  // screen's cache produced.
  saleFormVarieties: (on: string) => ['sale-form', 'varieties', on] as const,
  saleFormCustomer: (id: string) => ['sale-form', 'customer', id] as const,
  // "Elegir cliente"'s own search (`NuevaVentaCliente.tsx`): its results are where
  // the preview's `vip` comes from once a customer is chosen, so it is frozen the
  // same way — a result cached by an earlier mount, with a since-changed `vip`,
  // must never be the one a seller picks.
  saleFormCustomerSearch: (q: string) => ['sale-form', 'customer-search', q] as const,
}

// A write on one resource that also stales another, beyond its own prefix (plan,
// "Server state"): a category write touches the month view that lists them; a
// business rename touches what `GET /auth/me` already cached.
const CROSS_INVALIDATES: Partial<Record<Resource, Resource[]>> = {
  expenseCategories: ['expenses'],
  business: ['me'],
}

/** Invalidates the whole prefix a write belongs to, plus its cross rule if it has
 * one. A mutation calls this instead of naming the query keys it affects by hand. */
export function invalidateResource(queryClient: QueryClient, resource: Resource): void {
  const resources = [resource, ...(CROSS_INVALIDATES[resource] ?? [])]
  for (const affected of resources) {
    queryClient.invalidateQueries({ queryKey: [PREFIX[affected]] })
  }
}
