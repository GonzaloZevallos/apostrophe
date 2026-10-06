/**
 * The business as `GET /business` answers it (name and users by email, sorted the way
 * the backend already sorts them), shared by the two Configuración groups that show
 * it. The business comes only from the session: the request never takes an id
 * (CODING_STANDARDS §9).
 */

import { useQuery } from '@tanstack/react-query'
import { get } from '../../api/client'
import { keys } from '../../api/keys'

export interface BusinessUser {
  email: string
}

export interface Business {
  name: string
  users: BusinessUser[]
}

export function useBusiness() {
  return useQuery({
    queryKey: keys.business(),
    queryFn: () => get<Business>('/business'),
  })
}
