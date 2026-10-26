/**
 * What sits behind the edit-entry sheet on a phone, on a direct address (ADR-0053; navigation.md's
 * back-with-no-history table, "Stock entry form, edit → All entries"): the list of every entry, from
 * the list's own query keys, so opened from inside the app it is already cached and a direct address
 * costs the two GETs the list would have made. It draws only from resolved data: while pending and
 * on any error it is empty, with no skeleton and no wording (the form route keeps its own errors).
 * It keeps the list's heading and reuses its rows, with nothing to delete from here. It draws no
 * chrome, no `h1` and no ids.
 */

import { useQuery } from '@tanstack/react-query'
import { useOutletContext } from 'react-router'
import { get } from '../../api/client'
import { keys } from '../../api/keys'
import type { Me } from '../../api/me'
import { readStock } from '../../api/stock'
import { COMMON_TEXT } from '../../copy/common'
import { EntryRows } from '../EntriesList'
import type { Variety } from '../Variedades'

function noDelete(): void {
  // The pane is a picture: nothing in it acts.
}

export default function EntriesBehind() {
  const me = useOutletContext<Me>()
  const varieties = useQuery({ queryKey: keys.varieties(), queryFn: () => get<Variety[]>('/varieties'), retry: false })
  const stock = useQuery({ queryKey: keys.stock(), queryFn: readStock, retry: false })

  if (varieties.data === undefined || stock.data === undefined) return null
  const nameOf = (id: number): string => varieties.data.find((variety) => variety.id === id)?.name ?? ''

  return (
    <div className="pantalla">
      <div className="cuerpo">
        <span className="encabezado__titulo">{COMMON_TEXT.allEntries}</span>
        {stock.data.entries.length > 0 && (
          <EntryRows
            rows={stock.data.entries.map((entry) => ({ ...entry, kind: 'entry' as const }))}
            today={me.today}
            nameOf={nameOf}
            varietyId={undefined}
            readOnly={false}
            onDelete={noDelete}
          />
        )}
      </div>
    </div>
  )
}
