/**
 * The name of the Phone country field as the phone walk meets it. The walk's device is
 * Argentine (`es-AR`, Buenos Aires), so detection shows Argentina, and the field's button is
 * named by its label followed by the shown value. The calling code is read from the served
 * stub, which is generated from `app/shared/phone_country.py`; no state restates it.
 */

import { CUSTOMERS_TEXT, phoneCountryName } from '../copy/customers.ts'
import { SERVED } from '../phone/served.fixture.ts'

const DETECTED = 'AR'

function detectedCallingCode(): string {
  const served = SERVED.find((country) => country.code === DETECTED)
  if (served === undefined) throw new Error(`${DETECTED} is not in the served countries`)
  return served.calling_code
}

/** The button that opens the Phone country list while the detected country is shown: "Phone country Argentina (+54)". */
export const DETECTED_COUNTRY_BUTTON = `${CUSTOMERS_TEXT.phoneCountryLabel} ${CUSTOMERS_TEXT.phoneCountryOption(
  phoneCountryName(DETECTED),
  detectedCallingCode(),
)}`
