/**
 * The Settings layout route (`ConfiguracionCompu.dc.html`): one pathless route shared by `/settings`
 * and every `/settings/*` screen, the same tree at every width. At 900 px and up it stands the
 * Settings list in a side column beside the open page; the page is told it is in that pane by
 * `SettingsPaneContext`, never by a route tree of its own per viewport.
 *
 * Only the column depends on the width. The provider, the wrapper and the keyed panel are always
 * rendered in the same places, so the page inside never remounts when the width crosses 900 px
 * and what was typed in it stays. On the phone the wrapper and the panel are `display: contents`.
 * The marked row comes from `activeSettingsRow` and from nothing else.
 */

import { Outlet, useLocation, useOutletContext } from 'react-router'
import type { Me } from '../../api/me'
import { useViewport } from '../../shell/useViewport'
import SettingsNav from './SettingsNav'
import { SettingsPaneContext } from './SettingsPaneContext'
import { activeSettingsRow } from './settingsRows'
import { useSettingsRowContext } from './useSettingsRowContext'

/** The list, in its own component so the two reads it needs happen only where it is on screen. */
function SettingsColumn() {
  const { ctx } = useSettingsRowContext()
  const { pathname } = useLocation()

  return (
    <aside className="ajustes-capa__celda">
      <div className="ajustes-capa__columna">
        <SettingsNav ctx={ctx} activeKey={activeSettingsRow(pathname, ctx)} />
      </div>
    </aside>
  )
}

export default function SettingsLayout() {
  const me = useOutletContext<Me>()
  const isComputer = useViewport() === 'computer'

  return (
    <SettingsPaneContext value={isComputer}>
      <div className="ajustes-capa">
        {isComputer ? <SettingsColumn /> : null}
        <div key="panel" className="ajustes-capa__panel">
          <Outlet context={me} />
        </div>
      </div>
    </SettingsPaneContext>
  )
}
