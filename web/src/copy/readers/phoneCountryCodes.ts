/**
 * The ISO codes of the Phone countries the front draws, in the order Settings lists them. It is the
 * server's `PhoneCountry` enum written out by hand: `tests/test_phone_country_front_names.py`
 * fails when the two differ, and `phoneCountryCodes.test.ts` fails when a code has no name in the
 * Copy module. It lives under `copy/readers/` and holds no text, like `shippedLanguages.ts`.
 */

export const PHONE_COUNTRY_CODES = ['AR', 'UY', 'CL', 'PY', 'BR', 'MX', 'ES', 'US'] as const
