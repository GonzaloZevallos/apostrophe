/**
 * The Yerba mark and the wordmark (glossary: "Yerba mark", "Wordmark"). The mark is always
 * the one committed file `public/icons/mark.svg`, drawn as an image and never inlined, so
 * no module under `src` holds its markup. It names the app and is never a control: no link,
 * no button, no hover or press state.
 *
 * The one variant is the lockup: the mark beside the word "apostrophe" (Geist 600) and an ’
 * in `--acento`; the group is one image named "apostrophe" and the mark inside it is
 * decorative.
 *
 * Its sizes are the `--marca-*` tokens, applied in `app.css`.
 *
 * The brand is the same in every language, so the name comes from the `brand:wordmark` key
 * that the Test locale copies verbatim (`web/scripts/i18n/pseudo.ts`).
 */

import { useTranslation } from 'react-i18next'

const MARK_SOURCE = '/icons/mark.svg'

export default function BrandMark() {
  const { t } = useTranslation()

  return (
    <span className="brand-mark brand-mark--lockup" role="img" aria-label={t('brand:wordmark')}>
      <img src={MARK_SOURCE} alt="" />
      <span className="brand-mark__word">
        {t('brand:wordmark')}
        <span className="brand-mark__apostrophe" aria-hidden="true">
          {'’'}
        </span>
      </span>
    </span>
  )
}
