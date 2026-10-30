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
 * The brand is the same in every language, so both names come from `brand:*` keys that the
 * Test locale copies verbatim (`web/scripts/i18n/pseudo.ts`).
 */

import { type RefObject, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const MARK_SOURCE = '/icons/mark.svg'
/** The drawn size of each variant, in CSS pixels. */
const MARK_SIZE = { mark: 24, lockup: 40 } as const

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
      <span className="brand-mark brand-mark--lockup" role="img" aria-label={t('common:brand.wordmark')}>
        <img src={MARK_SOURCE} alt="" width={MARK_SIZE.lockup} height={MARK_SIZE.lockup} />
        <span className="brand-mark__word">
          {t('common:brand.wordmark')}
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
      alt={t('common:brand.mark.label')}
      width={MARK_SIZE.mark}
      height={MARK_SIZE.mark}
      aria-hidden={visible ? undefined : true}
    />
  )
}
