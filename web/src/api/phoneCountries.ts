/**
 * The listed Phone countries as `GET /phone-countries` answers them: the same list for every
 * business, in the order the Selector shows. The front holds no calling code, length or example
 * of its own (docs/adr/0085): it shows what the API sends.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { get } from './client'
import { keys } from './keys'

/** One listed Phone country. `example` is the local form a seller types. */
export interface PhoneCountryListing {
  code: string
  /** The digits of the calling code, without the "+". */
  calling_code: string
  national_lengths: readonly number[]
  example: string
}

/** The listing query. While it is pending or failed, `data` is undefined: the form keeps its
 * Phone country Selector in `loading` and Save disabled rather than guess a country. */
export function usePhoneCountries(): UseQueryResult<PhoneCountryListing[]> {
  return useQuery({
    queryKey: keys.phoneCountries(),
    queryFn: () => get<PhoneCountryListing[]>('/phone-countries'),
  })
}
