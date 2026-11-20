/** "Send catalog": a link, or a disabled button with its reason in words (`Variedades` decides which). */

import Boton from '../../components/Boton'
import BotonLink from '../../components/BotonLink'
import { CATALOG } from '../../routes'
import { CATALOG_DISABLED_REASON, VARIETIES_TEXT } from '../../copy/varieties'

const CATALOG_REASON_ID = 'mandar-catalogo-motivo'

export default function SendCatalog({ disabled }: { disabled: boolean }) {
  if (!disabled) {
    return (
      <BotonLink to={CATALOG} icon="telegram">
        {VARIETIES_TEXT.mandarCatalogo}
      </BotonLink>
    )
  }
  return (
    <>
      <Boton icon="telegram" disabled ariaDescribedBy={CATALOG_REASON_ID}>
        {VARIETIES_TEXT.mandarCatalogo}
      </Boton>
      <p className="variedades__motivo" id={CATALOG_REASON_ID} data-copy="help">
        {CATALOG_DISABLED_REASON}
      </p>
    </>
  )
}
