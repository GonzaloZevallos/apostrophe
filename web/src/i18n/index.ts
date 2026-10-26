import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { missingKeyHandler } from './missingKeys'
import { productionOptions } from './options'
import { englishBundle, loadLocale, type LocaleLoader } from './resources'

const english = englishBundle()

/*
 * The one init, on `productionOptions` (`./options.ts`). English is in the bundle, so
 * `initAsync: false` makes `t` answer on the very first render with nothing to await. `escapeValue` is false because React escapes what it
 * renders; i18next escaping on top would show `&amp;` to a person. Missing keys are recorded
 * only under the test runner; production installs no handler and emits nothing.
 */
void i18n.use(initReactI18next).init({
  ...productionOptions,
  ns: Object.keys(english),
  resources: { en: english },
  ...(import.meta.env.MODE === 'test'
    ? {
        saveMissing: true,
        saveMissingTo: 'current' as const,
        saveMissingPlurals: false,
        missingKeyHandler,
      }
    : {}),
})

/** Adds one language's texts to the instance; it does not switch to it (`./language.ts` does). */
export async function installLocale(
  tag: string,
  loader: LocaleLoader = loadLocale,
): Promise<void> {
  const bundle = await loader(tag)
  for (const [ns, content] of Object.entries(bundle)) {
    i18n.addResourceBundle(tag, ns, content, true, true)
  }
}

export default i18n
