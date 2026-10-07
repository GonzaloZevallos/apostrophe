/**
 * The `/varieties` layout route (`VariedadesCompu.dc.html`), as `ClientesLayout` is for
 * Clientes: on a computer the list stays on the left and the active child route fills the
 * right pane (a variety's page, or the new-variety form drawn over them); on a phone it is
 * the child alone, which for `/varieties` itself is the list. The selection is the URL.
 */

import { Outlet, useOutletContext } from 'react-router'
import type { Me } from '../../api/me'
import { useIsComputer } from '../../components/useIsComputer'
import Variedades from '../Variedades'

export default function VarietiesLayout() {
  const me = useOutletContext<Me>()
  const computer = useIsComputer()
  if (!computer) return <Outlet context={me} />
  return (
    <div className="variedades-paneles">
      <div className="variedades-paneles__lista">
        <Variedades />
      </div>
      <div className="variedades-paneles__detalle">
        <Outlet context={me} />
      </div>
    </div>
  )
}
