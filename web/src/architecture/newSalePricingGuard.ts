/**
 * The guard for New sale's one price result. Three rules over every `.ts`/`.tsx` file of `src/`
 * except `src/architecture/` (comments blanked, so a name in prose is not a use):
 *
 * 1. The cast of a `PricedSale` to `CompleteSale` (the `as` keyword, then the type name) appears only
 *    in `sales/newSalePricing.ts`, test files included: the brand is put on the sale in one place,
 *    so a `CompleteSale` anywhere else was built by `pricedSaleOf`.
 * 2. The identifier `priceSale` appears in a non-test file only in `sales/pricing.ts` (its
 *    definition) and `sales/newSalePricing.ts` (its one caller): no component prices New sale's
 *    Sale by itself.
 * 3. In a non-test file the calls `useNewSaleReads(` and `pricedSaleOf(` appear only in
 *    `sales/useNewSalePricing.ts` and in the file each is defined in; and `NuevaVentaSheet.tsx` and
 *    `NuevaVentaProductos.tsx` never call `useNewSalePricing(`: the host calls the hook, the Sheet takes
 *    its result as props.
 */

import { withoutComments } from './closingGuards'

const SLASH = '\u002F'
const NEW_SALE_PRICING = ['src', 'sales', 'newSalePricing.ts'].join(SLASH)
const PRICING = ['src', 'sales', 'pricing.ts'].join(SLASH)
const USE_NEW_SALE_PRICING = ['src', 'sales', 'useNewSalePricing.ts'].join(SLASH)
const USE_NEW_SALE_READS = ['src', 'sales', 'useNewSaleReads.ts'].join(SLASH)
const SHEET = ['src', 'screens', 'ventas', 'NuevaVentaSheet.tsx'].join(SLASH)
const PRODUCT_LIST = ['src', 'screens', 'ventas', 'NuevaVentaProductos.tsx'].join(SLASH)
const ARCHITECTURE = ['src', 'architecture', ''].join(SLASH)

/** The cast, spelled from parts so this file does not itself contain the text it forbids elsewhere. */
const COMPLETE_CAST = new RegExp(['\\bas', '\\s+', 'CompleteSale\\b'].join(''))
const PRICE_SALE = /\bpriceSale\b/
const READS_CALL = /\buseNewSaleReads\s*\(/
const PRICED_SALE_CALL = /\bpricedSaleOf\s*\(/
const HOOK_CALL = /\buseNewSalePricing\s*\(/

/** The files that break a rule, one `path: rule` line each, for a map of path to source. */
export function newSalePricingOffenders(files: Readonly<Record<string, string>>): string[] {
  const offenders: string[] = []
  for (const [rawPath, source] of Object.entries(files)) {
    const path = rawPath.split('\\').join(SLASH).replace(/^\//, '')
    if (!/\.tsx?$/.test(path) || path.startsWith(ARCHITECTURE)) continue
    const code = withoutComments(source)
    if (path !== NEW_SALE_PRICING && COMPLETE_CAST.test(code)) offenders.push(`${path}: cast to CompleteSale`)
    const isTest = /\.test\.tsx?$/.test(path)
    if (!isTest && path !== PRICING && path !== NEW_SALE_PRICING && PRICE_SALE.test(code)) {
      offenders.push(`${path}: priceSale`)
    }
    if (!isTest && path !== USE_NEW_SALE_PRICING) {
      if (path !== USE_NEW_SALE_READS && READS_CALL.test(code)) offenders.push(`${path}: useNewSaleReads call`)
      if (path !== NEW_SALE_PRICING && PRICED_SALE_CALL.test(code)) offenders.push(`${path}: pricedSaleOf call`)
    }
    if ((path === SHEET || path === PRODUCT_LIST) && HOOK_CALL.test(code)) {
      offenders.push(`${path}: useNewSalePricing call`)
    }
  }
  return offenders
}
