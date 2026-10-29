/**
 * What sits behind the new stock entry's sheet on a phone, on a direct address (ADR-0062;
 * navigation.md's back-with-no-history table, "Stock entry form, new → Varieties"): the Varieties
 * list, from the list's own query keys, so opened from inside the app it is already cached and a
 * direct address costs the two GETs the list would have made. It draws only from resolved data:
 * while pending and on any error it is empty, with no skeleton and no wording (the form route keeps
 * its own errors). It keeps the list's heading and summary line and reuses its rows, so the page
 * does not shift under the sheet; it leaves out the actions, the catalog's "Oculta" mark and the
 * links at the foot, which would each cost a read of their own. It draws no chrome, no `h1` and no ids.
 */

import { useQuery } from '@tanstack/react-query'
import { useOutletContext } from 'react-router'
import { get } from '../../api/client'
import { keys } from '../../api/keys'
import type { Me } from '../../api/me'
import { readStock } from '../../api/stock'
import { COMMON_TEXT } from '../../copy/common'
import { summaryLine } from '../../stock/summaryLine'
import { type Variety, VarietyRows } from '../Variedades'
import { varietiesByName } from './varietiesByName'

const NOBODY_HIDDEN: ReadonlySet<number> = new Set()

export default function VarietiesBehind() {
  const me = useOutletContext<Me>()
  const varieties = useQuery({
    queryKey: keys.varieties(),
    queryFn: () => get<Variety[]>('/api/products'),
    retry: false,
  })
  const stock = useQuery({
    queryKey: keys.stock(),
    queryFn: readStock,
    retry: false,
  })

  if (varieties.data === undefined || stock.data === undefined) return null
  const stockRows = stock.data.varieties
  const rows = varietiesByName(varieties.data).flatMap((variety) => {
    const row = stockRows.find((candidate) => candidate.variety_id === variety.id)
    return row === undefined ? [] : [{ variety, row }]
  })

  return (
    <div className="pantalla variedades">
      <div className="cuerpo">
        <span className="encabezado__titulo">{COMMON_TEXT.varieties}</span>
        {rows.length > 0 && <p className="pie variedades__resumen">{summaryLine(rows.map(({ row }) => row.status))}</p>}
        {rows.length > 0 && <VarietyRows rows={rows} hidden={NOBODY_HIDDEN} today={me.today} computer={false} />}
      </div>
    </div>
  )
}
