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
import { VARIETIES_TEXT } from '../../copy/varieties'

const NONE = '—'

type Attributes = Pick<CatalogVariety, 'shown' | 'emoji' | 'indica_share' | 'aroma'>

export default function VarietyCatalogSection({ row, readOnly = false }: { row: Attributes; readOnly?: boolean }) {
  const openForm = useOpenForm()
  if (readOnly) {
    const stored: [string, string | null, boolean][] = [
      [VARIETIES_TEXT.emoji, row.emoji, false],
      [VARIETIES_TEXT.indica, row.indica_share === null ? null : `${row.indica_share} %`, true],
      [VARIETIES_TEXT.aromaSabor, row.aroma, false],
    ]
    return (
      <section id={CATALOG_SECTION_ID} className="seccion-variedad">
        <div className="seccion-variedad__cabecera">
          <h2 className="seccion-variedad__titulo">{VARIETIES_TEXT.enElCatalogo}</h2>
        </div>
        <dl className="seccion-variedad__datos">
          <div className="seccion-variedad__dato">
            <dt>{VARIETIES_TEXT.mostrarEnElCatalogo}</dt>
            <dd>{row.shown ? VARIETIES_TEXT.seMuestra : VARIETIES_TEXT.noSeMuestra}</dd>
          </div>
          {stored.map(([label, value, isFigure]) =>
            value === null ? null : (
              <div key={label} className="seccion-variedad__dato">
                <dt>{label}</dt>
                <dd className={isFigure ? 'cifra-n' : undefined}>{value}</dd>
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
        <h2 className="seccion-variedad__titulo">{VARIETIES_TEXT.enElCatalogo}</h2>
        <Boton variant="icon" action="edit" ariaLabel={VARIETIES_TEXT.editarCatalogo} onClick={() => openForm('catalog')} />
      </div>
      <dl className="seccion-variedad__datos">
        <div className="seccion-variedad__dato">
          <dt>{VARIETIES_TEXT.mostrarEnElCatalogo}</dt>
          <dd>{row.shown ? VARIETIES_TEXT.seMuestra : VARIETIES_TEXT.noSeMuestra}</dd>
        </div>
        <div className="seccion-variedad__dato">
          <dt>{VARIETIES_TEXT.emoji}</dt>
          <dd>{row.emoji ?? NONE}</dd>
        </div>
        <div className="seccion-variedad__dato">
          <dt>{VARIETIES_TEXT.indica}</dt>
          <dd className={row.indica_share === null ? undefined : 'cifra-n'}>{row.indica_share === null ? NONE : `${row.indica_share} %`}</dd>
        </div>
        <div className="seccion-variedad__dato">
          <dt>{VARIETIES_TEXT.aromaSabor}</dt>
          <dd>{row.aroma ?? NONE}</dd>
        </div>
      </dl>
    </section>
  )
}
