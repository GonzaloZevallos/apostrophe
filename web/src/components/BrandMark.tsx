/**
 * The Yerba mark and the wordmark (glossary: "Yerba mark", "Wordmark"). The mark is always
 * the one committed file `public/icons/mark.svg`, drawn as an image and never inlined, so
 * no module under `src` holds its markup. It names the app and is never a control: no link,
 * no button, no hover or press state.
 *
 * `lockup` is the mark beside the word "apostrophe" (Geist 600) and an ’ in `--acento`; the
 * group is one image named "apostrophe" and the mark inside it is decorative. `mark` is the
 * mark alone, an image named "apostrophe" while it is visible. Its only state is
 * `aria-hidden`: set while the optional `clipRoot` clips it, and always when the browser has
 * no `IntersectionObserver`. Layout never depends on that state.
 *
 * Its sizes are the `--marca-*` tokens, applied in `app.css`.
 *
 * The brand is the same in every language, so both names come from `brand:*` keys that the
 * Test locale copies verbatim (`web/scripts/i18n/pseudo.ts`).
 */

import { type RefObject, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const MARK_SOURCE = '/icons/mark.svg'

export default function BrandMark({
  variant,
  clipRoot,
}: {
  variant: 'mark' | 'lockup'
  clipRoot?: RefObject<Element | null>
}) {
  const { t } = useTranslation()
  const imageRef = useRef<HTMLImageElement>(null)
  const [visible, setVisible] = useState(false)
  const observes = variant === 'mark'

  useEffect(() => {
    const image = imageRef.current
    if (!observes || image === null || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries[entries.length - 1]?.isIntersecting ?? false),
      { root: clipRoot?.current ?? null },
    )
    observer.observe(image)
    return () => observer.disconnect()
  }, [observes, clipRoot])

  if (variant === 'lockup') {
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

  return (
    <img
      ref={imageRef}
      className="brand-mark brand-mark--mark"
      src={MARK_SOURCE}
      alt={t('brand:mark.label')}
      aria-hidden={visible ? undefined : true}
    />
  )
}
