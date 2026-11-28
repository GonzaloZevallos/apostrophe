/**
 * `SettingsNav`, the one Settings list: the three shortcuts, then each group with its shown rows,
 * under the Business card when `card` is given. Every label, second line, icon and address comes
 * from `settingsRows.ts` (ADR-20261119); this file declares none.
 *
 * `activeKey` marks one group row (`aria-current="page"` and a weight-and-bar modifier class);
 * it comes from `activeSettingsRow`, never from this file. Without it the DOM is the phone's as
 * it always was. Shortcuts are never marked.
 *
 * The strip always reads the full registry (`shortcutTarget` with no rows), whatever `rows`
 * the groups are given. Keys are the row key, the shortcut's row and the group id, never `to`:
 * the business name and the language share one address.
 *
 * Each link also wears `ajustes__item`, the entry class `closingGuards` exempts for the rows of the
 * settings (an icon and a word on a link that opens a page); the `ajustes-inicio__*` rules after it
 * restate what differs.
 */

import { useTranslation } from 'react-i18next'
import Icono from '../../components/Icono'
import InAppLink from '../../components/InAppLink'
import {
  SETTINGS_ROWS,
  SHORTCUTS,
  shortcutTarget,
  shownRowsByGroup,
  type SettingsRow,
  type SettingsRowContext,
  type SettingsRowKey,
} from './settingsRows'

interface SettingsNavCard {
  readonly businessName: string
  readonly userCount: number | undefined
}

interface SettingsNavProps {
  readonly ctx: SettingsRowContext
  readonly rows?: readonly SettingsRow[]
  readonly card?: SettingsNavCard
  readonly activeKey?: SettingsRowKey
}

const ENTERED_FROM_SETTINGS = { enteredFrom: 'settings' }

export default function SettingsNav({ ctx, rows = SETTINGS_ROWS, card, activeKey }: SettingsNavProps) {
  const { t } = useTranslation()

  return (
    <>
      {card === undefined ? null : <BusinessCard {...card} />}
      <div className="ajustes-inicio">
        <ul className="ajustes-inicio__atajos">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.row} className="ajustes-inicio__atajo-celda">
              <InAppLink
                to={shortcutTarget(shortcut)}
                state={ENTERED_FROM_SETTINGS}
                className="ajustes__item ajustes-inicio__atajo"
              >
                <span className="ajustes-inicio__ficha">
                  <Icono nombre={shortcut.icon} />
                </span>
                <span className="ajustes-inicio__atajo-rotulo">{t(shortcut.labelKey)}</span>
              </InAppLink>
            </li>
          ))}
        </ul>
        {shownRowsByGroup(ctx, rows).map((entry) => (
          <section key={entry.group} className="ajustes-inicio__grupo">
            <h2 className="ajustes-inicio__titulo">{t(entry.labelKey)}</h2>
            <ul className="ajustes-inicio__tarjeta">
              {entry.rows.map((row) => {
                const isActive = row.key === activeKey
                return (
                  <li key={row.key} className="ajustes-inicio__fila-celda">
                    <InAppLink
                      to={row.to}
                      state={ENTERED_FROM_SETTINGS}
                      className={
                        isActive
                          ? 'ajustes__item ajustes-inicio__fila ajustes-inicio__fila--actual'
                          : 'ajustes__item ajustes-inicio__fila'
                      }
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <span className="ajustes-inicio__icono">
                        <Icono nombre={row.icon} />
                      </span>
                      <span className="ajustes-inicio__textos">
                        <span className="ajustes-inicio__rotulo">{t(row.labelKey)}</span>{' '}
                        <span className="ajustes-inicio__detalle">{t(row.descriptionKey)}</span>
                      </span>
                      <span className="ajustes-inicio__flecha" aria-hidden="true">
                        <Icono nombre="chevron" />
                      </span>
                    </InAppLink>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}

/** The read-only Business card: no role, link, button or chevron. The count slot stays empty until
 * the count is known, so a wrong count never shows. */
function BusinessCard({ businessName, userCount }: SettingsNavCard) {
  const { t } = useTranslation()
  const initial = Array.from(businessName.trim())[0]

  return (
    <div className="ajustes-inicio-tarjeta__tarjeta">
      <span className="ajustes-inicio-tarjeta__inicial">{initial}</span>
      <span className="ajustes-inicio-tarjeta__textos">
        <span className="ajustes-inicio-tarjeta__nombre">{businessName}</span>
        <span className="ajustes-inicio-tarjeta__cantidad">
          {userCount === undefined ? '' : t('settings:card.users', { count: userCount })}
        </span>
      </span>
    </div>
  )
}
