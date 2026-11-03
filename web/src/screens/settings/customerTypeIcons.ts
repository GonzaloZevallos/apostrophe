/**
 * The icon of each customer type: the backend's `CustomerTypeIcon` keys, each drawn by `Icono`.
 * The map is closed over the keys and `customerTypeIcons.test.ts` checks it against the OpenAPI
 * snapshot, so a key the backend adds or drops fails there. `circle` is the default.
 */

import type { CustomerTypeIconKey } from '../../api/customerTypes'
import type { NombreIcono } from '../../components/Icono'

interface CustomerTypeIconEntry {
  key: CustomerTypeIconKey
  icono: NombreIcono
}

/** In the order the picker shows them. */
const ENTRIES: readonly CustomerTypeIconEntry[] = [
  { key: 'circle', icono: 'circulo' },
  { key: 'star', icono: 'estrella' },
  { key: 'heart', icono: 'corazon' },
  { key: 'diamond', icono: 'rombo' },
  { key: 'flag', icono: 'bandera' },
  { key: 'tag', icono: 'etiqueta' },
  { key: 'crown', icono: 'corona' },
  { key: 'bell', icono: 'campana' },
]

export const CUSTOMER_TYPE_ICONS = Object.fromEntries(
  ENTRIES.map(({ key, icono }) => [key, icono]),
) as Record<CustomerTypeIconKey, NombreIcono>

export const DEFAULT_CUSTOMER_TYPE_ICON: CustomerTypeIconKey = 'circle'

export const CUSTOMER_TYPE_ICON_ORDER: readonly CustomerTypeIconKey[] = ENTRIES.map(({ key }) => key)
