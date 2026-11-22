/**
 * `SettingsHomeList`, the list part of the phone Settings home: the three shortcuts, then each
 * group with its shown rows. Every label, second line, icon and address comes from
 * `settingsRows.ts` (ADR-20261119); this file declares none. Not wired to a screen yet.
 *
 * The strip always reads the full registry (`shortcutTarget` with no rows), whatever `rows`
 * the groups are given. Keys are the row key, the shortcut's row and the group id, never `to`:
 * the business name and the language share one address.
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
} from './settingsRows'

interface SettingsHomeListProps {
  readonly ctx: SettingsRowContext
  readonly rows?: readonly SettingsRow[]
}

const ENTERED_FROM_SETTINGS = { enteredFrom: 'settings' }

export default function SettingsHomeList({ ctx, rows = SETTINGS_ROWS }: SettingsHomeListProps) {
  const { t } = useTranslation()

  return (
    <div className="ajustes-inicio">
      <ul className="ajustes-inicio__atajos">
        {SHORTCUTS.map((shortcut) => (
          <li key={shortcut.row} className="ajustes-inicio__atajo-celda">
            <InAppLink
              to={shortcutTarget(shortcut)}
              state={ENTERED_FROM_SETTINGS}
              className="ajustes-inicio__atajo"
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
            {entry.rows.map((row) => (
              <li key={row.key} className="ajustes-inicio__fila-celda">
                <InAppLink to={row.to} state={ENTERED_FROM_SETTINGS} className="ajustes-inicio__fila">
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
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
