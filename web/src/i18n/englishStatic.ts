/**
 * The English `common`, `emptyStates`, `expenses`, `products`, `refusals`, `sales` and `settings` bundles, imported statically so the code that cannot
 * load i18next (the browserless core the Playwright walk imports, the refusal table built at
 * load) has English words without touching `locales/` itself. This is the one module outside
 * `resources.ts` that imports the locale files.
 *
 * It imports only these seven JSON files: no `import.meta` and no other value import, so
 * `mobile-standard/imports.test.ts` keeps the browserless core valid.
 */

import emptyStates from '../copy/locales/en/emptyStates.json' with { type: 'json' }
import expenses from '../copy/locales/en/expenses.json' with { type: 'json' }
import common from '../copy/locales/en/common.json' with { type: 'json' }
import products from '../copy/locales/en/products.json' with { type: 'json' }
import refusals from '../copy/locales/en/refusals.json' with { type: 'json' }
import sales from '../copy/locales/en/sales.json' with { type: 'json' }
import settings from '../copy/locales/en/settings.json' with { type: 'json' }

export { common, emptyStates, expenses, products, refusals, sales, settings }

export const ENGLISH_STATIC = { common, emptyStates, expenses, products, refusals, sales, settings } as const
