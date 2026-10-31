/** `GET /api/products?archived=true` as a query: the archived varieties, which "Archivadas (N)",
 * the Archivadas card and a computer's selection all read through the one key. */

import { queryOptions } from '@tanstack/react-query'
import { get } from '../../api/client'
import { keys } from '../../api/keys'
import type { Variety } from '../Variedades'

export function archivedVarietiesQueryOptions() {
  return queryOptions({
    queryKey: keys.archivedVarieties(),
    queryFn: () => get<Variety[]>('/api/products?archived=true'),
  })
}
