/**
 * The Home | Analysis segment on the phone's Home and Analysis: navigation between the two
 * views of the business, not a choice kept anywhere (Home always opens on its Home view). Two links
 * in a named group, each one a `Link` that replaces the history entry, so any number of
 * switches leaves Back where it was. The marked option is the screen's own `segment` in the
 * registry (`placeOf(...).segment`), read through the same leaf screen the shell reads for the
 * bar, and carries `aria-current`, so the state is not told by colour alone. A link's target
 * is the registry's too (`screenOfSegment`). The computer reaches Analysis from the side rail,
 * so there it draws nothing.
 */

import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { placeOf, screenOfSegment } from '../routes'
import { useLeafScreen } from '../shell/useLeafScreen'
import { useViewport } from '../shell/useViewport'
import { HOME_VIEWS } from './fixedSets'

export default function HomeViewSwitch() {
  const { t } = useTranslation()
  const viewport = useViewport()
  const marked = placeOf(useLeafScreen().id, viewport).segment
  if (viewport === 'computer') return null
  return (
    <div role="group" aria-label={t('common:homeViewSwitchLabel')} className="inicio-segmentos">
      {HOME_VIEWS.map((option) => {
        const current = option.value === marked
        return (
          <Link
            key={option.value}
            replace
            to={screenOfSegment(option.value).path}
            aria-current={current ? 'page' : undefined}
            className={current ? 'inicio-segmento inicio-segmento--activa' : 'inicio-segmento'}
          >
            <span className="inicio-segmento__pill">{option.label()}</span>
          </Link>
        )
      })}
    </div>
  )
}
