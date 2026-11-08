/**
 * The English `common` and `refusals` bundles, imported statically so the code that cannot
 * load i18next (the browserless core the Playwright walk imports, the refusal table built at
 * load) has English words without touching `locales/` itself. This is the one module outside
 * `resources.ts` that imports the locale files.
 *
 * It imports only these two JSON files: no `import.meta` and no other value import, so
 * `mobile-standard/imports.test.ts` keeps the browserless core valid.
 */

import common from '../copy/locales/en/common.json' with { type: 'json' }
import refusals from '../copy/locales/en/refusals.json' with { type: 'json' }

export { common, refusals }

export const ENGLISH_STATIC = { common, refusals } as const
