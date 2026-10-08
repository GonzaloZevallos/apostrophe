/**
 * `Archivadas` (`/varieties/archived`; `varieties.md`, "Archivadas"): a card, "‹ Variedades"
 * and no "+ Nueva venta", listing the archived varieties by name. Each row is marked
 * "Archivada" in words and has "Restaurar", one tap with no confirmation. A row opens the
 * variety's own page, read-only. With none, a fixed line says so.
 *
 * Built from the list's own rows and buttons: `pantallas/` holds no drawing of it yet.
 * Nothing here decides anything: the list is `GET /varieties?archived=true`, by name.
 */

import { useQuery } from '@tanstack/react-query'

import BotonLink from '../../components/BotonLink'
import { NetworkError } from '../../api/client'
import ErrorGenerico from '../../components/ErrorGenerico'
import Loading from '../../components/Loading'
import SinConexion from '../../components/SinConexion'
import { VARIETIES, VARIETY, pathTo } from '../../routes'
import { useViewport } from '../../shell/useViewport'
import { archivedVarietiesQueryOptions } from './archivedVarieties'
import { useRestore } from './useRestore'
import { NO_ARCHIVED_MESSAGE } from './varietiesMessages'
import VarietyRowLink from './VarietyRowLink'
import { varietiesByName } from './varietiesByName'


export default function ArchivedVarieties() {
  const computer = useViewport() === 'computer'
  const query = useQuery(archivedVarietiesQueryOptions())
  const { restore, sending, notice } = useRestore()
  const failure = query.error

  return (
    <main className="pantalla variedades">
      <div className="cuerpo">
        <div className="encabezado__fila">
          <BotonLink to={VARIETIES} variant="back">
            ‹ Variedades
          </BotonLink>
        </div>
        <h1 className="encabezado__titulo">Archivadas</h1>
        {notice}
        {failure !== null && (failure instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />)}
        {failure === null && query.data === undefined && <Loading />}
        {query.data !== undefined && query.data.length === 0 && (
          <div className="estado-vacio">
            <span className="estado-vacio__titulo" data-copy="emptyTitle">{NO_ARCHIVED_MESSAGE}</span>
          </div>
        )}
        {query.data !== undefined && query.data.length > 0 && (
          <div className="lista-variedades">
            {varietiesByName(query.data).map((variety) => (
              <div key={variety.id} className="variedad-archivada">
                <VarietyRowLink to={pathTo(VARIETY, { id: variety.id })} replace={computer}>
                  <span className="variedad-fila__encabezado">
                    <span className="variedad-fila__nombre">{variety.name}</span>
                    <span className="variedad-fila__oculta">Archivada</span>
                  </span>
                </VarietyRowLink>
                <button
                  type="button"
                  className="boton boton--suave variedad-archivada__restaurar"
                  disabled={sending}
                  onClick={() => void restore(variety.id)}
                >
                  Restaurar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
