/**
 * What `/varieties/archived` itself shows: on a phone the Archivadas card; on a computer
 * (where the layout already draws the card on the left) it selects the first archived
 * variety by name with `replace` once there is one, and nothing until then.
 */

import { useQuery } from '@tanstack/react-query'
import { Navigate } from 'react-router'
import { FOLLOWED_REDIRECT } from '../../flash/flashReducer'
import { VARIETY, pathTo } from '../../routes'
import { useViewport } from '../../shell/useViewport'
import { archivedVarietiesQueryOptions } from './archivedVarieties'
import ArchivedVarieties from './ArchivedVarieties'
import { varietiesByName } from './varietiesByName'

export default function ArchivedIndex() {
  const computer = useViewport() === 'computer'
  const { data } = useQuery({ ...archivedVarietiesQueryOptions(), enabled: computer })
  if (!computer) return <ArchivedVarieties />
  const first = data === undefined ? undefined : varietiesByName(data)[0]
  if (first === undefined) return null
  return <Navigate to={pathTo(VARIETY, { id: first.id })} replace state={FOLLOWED_REDIRECT} />
}
