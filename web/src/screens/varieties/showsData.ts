/** Whether the Products phone body may draw its summary, rows and empty state: ready data, no failure. */

import type { ProductsView } from './ProductsBody'

export function showsData(view: ProductsView): boolean {
  return view.failure === null && view.ready
}
