/**
 * The phone's one entry to Settings: the business's initials in a disc at the end of the
 * header row of Home, Sales, Customers, Products, Analysis and Expenses. Its name is the fixed
 * word "Settings", not the business (the initials are the glyph, not the name). The computer
 * has the side rail's Business row instead, so there it draws nothing (a viewport decision,
 * `useViewport`, not CSS: no hidden twin is left in the page for a screen reader).
 */

import { useOutletContext } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { Me } from '../api/me'
import { initialsOf } from '../format/initials'
import { SETTINGS } from '../routes'
import { useViewport } from '../shell/useViewport'
import InAppLink from './InAppLink'

export default function SettingsAvatar() {
  const { t } = useTranslation()
  const me = useOutletContext<Me>()
  if (useViewport() === 'computer') return null
  return (
    <InAppLink to={SETTINGS} aria-label={t('common:settings')} className="inicio__avatar">
      {initialsOf(me.business_name)}
    </InAppLink>
  )
}
