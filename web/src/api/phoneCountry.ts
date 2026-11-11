/**
 * The business's Phone country (`accounts.md`, docs/adr/0082): `GET /business` carries the stored
 * ISO code (or null) and the countries it may take, each with its calling code, in the order
 * Settings lists them. `PUT /business/phone-country` is the one way to change it. The front
 * holds no calling code and no length of its own: it shows what the API sends.
 */

import { useQuery } from '@tanstack/react-query'
import { get, put } from './client'
import { keys } from './keys'

export interface PhoneCountryOption {
  code: string
  /** The digits of the calling code, without the "+". */
  calling_code: string
}

/** What `PUT /business/phone-country` answers. */
export interface BusinessPhoneCountry {
  phone_country: string | null
  phone_countries: readonly PhoneCountryOption[]
}

export function savePhoneCountry(phoneCountry: string | null): Promise<BusinessPhoneCountry> {
  return put<BusinessPhoneCountry>('/business/phone-country', { phone_country: phoneCountry })
}

/** The stored Phone country for the screens that follow it (the phone field's placeholder). Until
 * the answer comes, and if it fails, `loaded` is false: the field then shows no example rather
 * than a wrong one. */
export function usePhoneCountry(): { loaded: boolean; country: string | null } {
  const data = useQuery({
    queryKey: keys.business(),
    queryFn: () => get<BusinessPhoneCountry>('/business'),
  }).data
  return data === undefined
    ? { loaded: false, country: null }
    : { loaded: true, country: data.phone_country ?? null }
}
