/**
 * "En el catálogo" on a variety's page: shown or not, emoji, % índica and
 * aroma/sabor as `GET /catalog` answered them, and "Editar". It is the anchor the catalog
 * screen links to (`CATALOG_SECTION_ID`). Shown or hidden is the server's own `shown`; the
 * reason a variety is left out is never worked out here.
 *
 * `readOnly` (an archived variety, whose attributes `GET /catalog/archived` answers) shows
 * the stored ones only: an attribute never set is left out, and there is no "Editar".
 */

import type { CatalogVariety } from '../../api/catalog'
import Boton from '../../components/Boton'
import { CATALOG_SECTION_ID } from '../../routes'
import { useOpenForm } from './varietyForms'

const NONE = '—'

type Attributes = Pick<CatalogVariety, 'shown' | 'emoji' | 'indica_share' | 'aroma'>

export default function VarietyCatalogSection({ row, readOnly = false }: { row: Attributes; readOnly?: boolean }) {
  const openForm = useOpenForm()
  if (readOnly) {
    const stored: [string, string | null][] = [
      ['Emoji', row.emoji],
      ['% índica', row.indica_share === null ? null : `${row.indica_share} %`],
      ['Aroma/sabor', row.aroma],
    ]
    return (
      <section id={CATALOG_SECTION_ID} className="seccion-variedad">
        <div className="seccion-variedad__cabecera">
          <h2 className="seccion-variedad__titulo">En el catálogo</h2>
        </div>
        <dl className="seccion-variedad__datos">
          <div className="seccion-variedad__dato">
            <dt>Mostrar en el catálogo</dt>
            <dd>{row.shown ? 'Se muestra' : 'No se muestra'}</dd>
          </div>
          {stored.map(([label, value]) =>
            value === null ? null : (
              <div key={label} className="seccion-variedad__dato">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ),
          )}
        </dl>
      </section>
    )
  }
  return (
    <section id={CATALOG_SECTION_ID} className="seccion-variedad">
      <div className="seccion-variedad__cabecera">
        <h2 className="seccion-variedad__titulo">En el catálogo</h2>
        <Boton variant="icon" action="edit" ariaLabel="Editar catálogo" onClick={() => openForm('catalog')} />
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
