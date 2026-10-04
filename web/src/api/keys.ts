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
  | 'sales'
  | 'stock'
  | 'catalog'
  | 'payments'

const PREFIX: Record<Resource, string> = {
  me: 'me',
  business: 'business',
  varieties: 'varieties',
  customers: 'customers',
  expenses: 'expenses',
  expenseCategories: 'expense-categories',
  sales: 'sales',
  stock: 'stock',
  catalog: 'catalog',
  payments: 'payments',
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
  sales: (dateFrom: string, dateTo: string) => [PREFIX.sales, { dateFrom, dateTo }] as const,
  sale: (id: string) => [PREFIX.sales, id] as const,
  stock: () => [PREFIX.stock] as const,
  stockEntry: (id: string) => [PREFIX.stock, 'entries', id] as const,
  // Frozen at the call site (`gcTime: 0`, `staleTime: Infinity`, plan, "Front"), the
  // same way `saleFormVarieties` is: a save's own answer replaces this key's data
  // directly through `setQueryData`, so this prefix is never invalidated either.
  catalog: () => [PREFIX.catalog] as const,
  customerAccount: (id: string) => [PREFIX.payments, 'account', id] as const,
  debtors: () => [PREFIX.payments, 'debtors'] as const,
  // "Registrar cobro"'s own preview (plan, "keys.ts"): a dry-run of the settlement,
  // never cached across calls (`gcTime: 0` at the call site) and outside the
  // `Resource`/`PREFIX` invalidation system, the same way `saleFormVarieties` is —
  // the last answer always wins, and no write anywhere ever needs to invalidate it.
  paymentPreview: (customerId: string, paidOn: string, amount: number) =>
    ['payment-form', 'preview', customerId, paidOn, amount] as const,
  // `Analisis`'s own read (plan, "API client"): frozen the same way `catalog` is
  // (`gcTime: 0`, `staleTime: Infinity` at the call site) — the screen always
  // fetches on open, so this key is never invalidated by a write elsewhere either.
  analysis: (month: string) => ['analysis', month] as const,
}

// A write on one resource that also stales another, beyond its own prefix (plan,
// "Server state"): a category write touches the month view that lists them; a
// business rename touches what `GET /auth/me` already cached; a payment touches the
// customer's balance and the sale it settled; a sale touches its customer's balance
// and, having left one owing or not, "Te deben"; a customer rename shows in it too.
const CROSS_INVALIDATES: Partial<Record<Resource, Resource[]>> = {
  expenseCategories: ['expenses'],
  business: ['me'],
  payments: ['customers', 'sales'],
  sales: ['customers', 'payments'],
  customers: ['payments'],
}

/** Invalidates the whole prefix a write belongs to, plus its cross rule if it has
 * one. A mutation calls this instead of naming the query keys it affects by hand.
 *
 * `refetchType: 'none'` (TanStack's own option, passed through) marks every
 * matching query stale without refetching any of them now: a screen that is
 * navigating away from a record it just deleted needs the *list* it is about to
 * land on to refetch on its next mount, never the record's own still-mounted
 * detail query — the bare prefix this invalidates also matches that detail key
 * (`keys.sale(id)` starts with the same `'sales'` prefix `keys.sales(...)` does),
 * and refetching a just-deleted record one tick before it unmounts answers 404,
 * which a browser always surfaces to its own console (CODING_STANDARDS.md section
 * 9: nothing of that kind belongs there, caught by the e2e run's own zero-message
 * assertion). The default (`undefined`, TanStack's own 'active') is unchanged for
 * every other call site, where the screen invalidating stays on the same page and
 * wants its own query refetched right away. */
export function invalidateResource(
  queryClient: QueryClient,
  resource: Resource,
  options?: { refetchType?: 'active' | 'inactive' | 'all' | 'none' },
): void {
  const resources = [resource, ...(CROSS_INVALIDATES[resource] ?? [])]
  for (const affected of resources) {
    queryClient.invalidateQueries({
      queryKey: [PREFIX[affected]],
      refetchType: options?.refetchType,
    })
  }
}
