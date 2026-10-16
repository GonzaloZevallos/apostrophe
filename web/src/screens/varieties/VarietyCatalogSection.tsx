/**
 * "En el catálogo" on a variety's page: shown or not, emoji, % índica and
 * aroma/sabor as `GET /catalog` answered them, and "Editar". `readOnly` (an archived
 * variety, whose values come from `GET /catalog/varieties/{id}`) draws the same values as
 * plain text and no "Editar". It is the anchor the catalog
 * screen links to (`CATALOG_SECTION_ID`). Shown or hidden is the server's own `shown`; the
 * reason a variety is left out is never worked out here.
 */

import { type VarietyAttributes } from '../../api/catalog'
import Boton from '../../components/Boton'
import { CATALOG_SECTION_ID } from '../../routes'
import { useOpenForm } from './varietyForms'

const NONE = '—'

export default function VarietyCatalogSection({ row, readOnly = false }: { row: VarietyAttributes; readOnly?: boolean }) {
  const openForm = useOpenForm()
  return (
    <section id={CATALOG_SECTION_ID} className="seccion-variedad">
      <div className="seccion-variedad__cabecera">
        <h2 className="seccion-variedad__titulo">En el catálogo</h2>
        {!readOnly && <Boton variant="icon" action="edit" ariaLabel="Editar catálogo" onClick={() => openForm('catalog')} />}
      </div>
      <dl className="seccion-variedad__datos">
        <div className="seccion-variedad__dato">
          <dt>Mostrar en el catálogo</dt>
          <dd>{row.shown ? 'Se muestra' : 'No se muestra'}</dd>
        </div>
        <div className="seccion-variedad__dato">
          <dt>Emoji</dt>
          <dd>{row.emoji ?? NONE}</dd>
        </div>
        <div className="seccion-variedad__dato">
          <dt>% índica</dt>
          <dd>{row.indica_share === null ? NONE : `${row.indica_share} %`}</dd>
        </div>
        <div className="seccion-variedad__dato">
          <dt>Aroma/sabor</dt>
          <dd>{row.aroma ?? NONE}</dd>
        </div>
      </dl>
    </section>
  )
}
