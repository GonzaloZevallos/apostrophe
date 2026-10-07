/**
 * The `/varieties` layout route (`VariedadesCompu.dc.html`), as `ClientesLayout` is for
 * Clientes: on a computer the list stays on the left and the active child route fills the
 * right pane (a variety's page, or the new-variety form drawn over them); on a phone it is
 * the child alone, which for `/varieties` itself is the list. The selection is the URL.
 */

import { useQuery } from '@tanstack/react-query'
import { Outlet, useMatch, useOutletContext } from 'react-router'
import { get } from '../../api/client'
import { keys } from '../../api/keys'
import type { Me } from '../../api/me'
import type { VarietyDetail } from '../../api/varieties'
import { ARCHIVED_VARIETIES, VARIETY } from '../../routes'
import { useViewport } from '../../shell/useViewport'
import Variedades from '../Variedades'
import ArchivedVarieties from './ArchivedVarieties'

export default function VarietiesLayout() {
  const me = useOutletContext<Me>()
  const computer = useViewport() === 'computer'
  // The left pane is the Archivadas card on its own route and beside an archived variety's
  // page (the same query as the page's own, so no extra request); the live list otherwise.
  const onArchivedCard = useMatch(ARCHIVED_VARIETIES) !== null
  const varietyId = useMatch(VARIETY)?.params.id
  const { data: opened } = useQuery({
    queryKey: keys.variety(varietyId ?? ''),
    queryFn: () => get<VarietyDetail>(`/varieties/${varietyId}`),
    enabled: computer && varietyId !== undefined && /^[0-9]+$/.test(varietyId),
  })
  const archivedPane = onArchivedCard || opened?.archived === true
  if (!computer) return <Outlet context={me} />
  return (
    <div className="variedades-paneles">
      <div className="variedades-paneles__lista">
        {archivedPane ? <ArchivedVarieties /> : <Variedades />}
      </div>
      <div className="variedades-paneles__detalle">
        <Outlet context={me} />
      </div>
    </div>
  )
}
