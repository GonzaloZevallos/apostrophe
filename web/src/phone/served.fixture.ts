/**
 * The answer of `GET /phone-countries` as a test stubs it: the shape the API serves, in its
 * order. A stub of the API, not a second table: the codes are read from
 * `servedCountries.json`, which `scripts/phone/zone_countries.py` writes from
 * `app/shared/phone_country.py` (the only place a calling code is declared), and
 * `tests/customers/test_zone_countries.py` fails when the committed file differs from a fresh
 * regeneration. `tests/customers/test_phone_plus_parity.py` runs the same `plusCases.json`
 * against that table.
 */
import served from './servedCountries.json'
import type { ListedCountry } from './types.ts'

export const SERVED: readonly ListedCountry[] = served.countries
