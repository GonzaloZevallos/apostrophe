/** The empty list's fixed state. The caller shows it only when ready, with no failure and no rows. */

import { EMPTY_DETAIL, EMPTY_TITLE } from '../../copy/varieties'

export default function ProductsEmpty() {
  return (
    <div className="estado-vacio">
      <span className="estado-vacio__titulo" data-copy="emptyTitle">
        {EMPTY_TITLE}
      </span>
      <span className="estado-vacio__detalle" data-copy="emptyLine">
        {EMPTY_DETAIL}
      </span>
    </div>
  )
}
