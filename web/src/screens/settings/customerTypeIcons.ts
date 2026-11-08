/**
 * The icon of each customer type: the backend's `CustomerTypeIcon` keys, each drawn by `Icono`,
 * declared once in the registry (`components/fixedSets.ts`). The map is closed over the keys and
 * `customerTypeIcons.test.ts` checks it against the OpenAPI snapshot, so a key the backend adds or drops fails there. `circle` is the default.
 */

import type { CustomerTypeIconKey } from '../../api/customerTypes'
import { CUSTOMER_TYPE_ICON_SET, type FixedValue } from '../../components/fixedSets'
import type { NombreIcono } from '../../components/Icono'
import { assertType, type Equal } from '../../components/typeEquals'

assertType<Equal<FixedValue<typeof CUSTOMER_TYPE_ICON_SET>, CustomerTypeIconKey>>()

export const CUSTOMER_TYPE_ICONS = Object.fromEntries(
  CUSTOMER_TYPE_ICON_SET.flatMap(({ value, icon }) => (icon === undefined ? [] : [[value, icon]])),
) as Record<CustomerTypeIconKey, NombreIcono>

export const DEFAULT_CUSTOMER_TYPE_ICON: CustomerTypeIconKey = 'circle'

/** In the order the picker shows them. */
export const CUSTOMER_TYPE_ICON_ORDER: readonly CustomerTypeIconKey[] = CUSTOMER_TYPE_ICON_SET.map(
  ({ value }) => value,
)
