/**
 * The answer of `GET /phone-countries` as a test stubs it: the shape the API serves, in its
 * order. A stub of the API, not a second table: the product states each code only in
 * `app/shared/phone_country.py`, and `tests/customers/test_phone_plus_parity.py` runs the same
 * `plusCases.json` against that table.
 */
import type { ListedCountry } from './types.ts'

export const SERVED: readonly ListedCountry[] = [
  { code: 'AR', calling_code: '54' },
  { code: 'UY', calling_code: '598' },
  { code: 'CL', calling_code: '56' },
  { code: 'PY', calling_code: '595' },
  { code: 'BR', calling_code: '55' },
  { code: 'MX', calling_code: '52' },
  { code: 'ES', calling_code: '34' },
  { code: 'US', calling_code: '1' },
]
