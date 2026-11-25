/**
 * The words of the phone Products tab's two segments, Catalog and Stock, and the accessible name
 * of the group that holds them: a getter each, backed by the i18next instance
 * (`i18n/instanceText.ts`), so a caller reads them in render, never at load. They live under
 * `copy/readers/` like `customerSegments.ts`, and the words are the `products:segment.*` keys:
 * this module holds none of its own.
 */

import { instanceText } from '../../i18n/instanceText.ts'

/** The two segments of Products; `components/fixedSets.ts` types its set with it. */
export type ProductsSegmentName = 'catalog' | 'stock'

export const PRODUCTS_SEGMENT_NAME: Readonly<Record<ProductsSegmentName, () => string>> = {
  catalog: () => instanceText('products:segment.catalog'),
  stock: () => instanceText('products:segment.stock'),
}

/** The accessible name of the segment group. */
export const PRODUCTS_SEGMENT_LABEL = (): string => instanceText('products:segment.label')
