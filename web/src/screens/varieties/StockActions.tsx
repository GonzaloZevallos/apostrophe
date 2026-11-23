/** "+ Stock entry" and "Take from stock": the two stock actions of the list. */

import BotonLink from '../../components/BotonLink'
import { STOCK_ENTRY_NEW, WITHDRAWAL_NEW } from '../../routes'
import { VARIETIES_TEXT } from '../../copy/varieties'
import { COMMON_TEXT } from '../../copy/common'

export default function StockActions() {
  return (
    <>
      <BotonLink to={STOCK_ENTRY_NEW} variant="secondary" icon="agregar" ariaLabel={VARIETIES_TEXT.entradaDeStock}>
        {COMMON_TEXT.stockEntry}
      </BotonLink>
      <BotonLink to={WITHDRAWAL_NEW} variant="secondary" icon="salidaStock">
        {COMMON_TEXT.takeFromStock}
      </BotonLink>
    </>
  )
}
