/**
 * The Today | Analysis segment on the phone's Home and Analysis: navigation between the two
 * views of the business, not a choice kept anywhere (Home always opens on Today). Two links
 * in a named group; the selected one carries `aria-current`, so the state is not told by
 * colour alone. It reuses the segment look of the Settings theme and language controls. The
 * computer reaches Analysis from the side rail, so there it draws nothing.
 */

import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ANALYSIS, HOME } from '../routes'
import { useViewport } from '../shell/useViewport'

export type HomeView = 'today' | 'analysis'

export default function HomeViewSwitch({ selected }: { selected: HomeView }) {
  const { t } = useTranslation()
  if (useViewport() === 'computer') return null
  const options = [
    { view: 'today', to: HOME, label: t('common:homeSegmentToday') },
    { view: 'analysis', to: ANALYSIS, label: t('common:homeSegmentAnalysis') },
  ] as const
  return (
    <div role="group" aria-label={t('common:homeViewSwitchLabel')} className="ajustes-tema">
      {options.map((option) => (
        <Link
          key={option.view}
          to={option.to}
          aria-current={option.view === selected ? 'page' : undefined}
          className={option.view === selected ? 'ajustes-tema__opcion ajustes-tema__opcion--activa' : 'ajustes-tema__opcion'}
        >
          {option.label}
        </Link>
      ))}
    </div>
  )
}
