/**
 * The languages the Copy module has texts for, written out by hand: a language is added here in
 * the same change that adds its folder under `copy/locales/` (`shippedLanguages.test.ts` fails
 * if the two disagree). It lives under `copy/readers/` and uses no `import.meta.glob`, because
 * globbing `locales/` is what `architecture/noTopLevelText.ts` forbids outside the i18n loader.
 * `components/fixedSets.ts` builds the language Fixed set from it; the server's Selectable list
 * only narrows that set.
 */

export const SHIPPED_LANGUAGE_TAGS = ['en'] as const
