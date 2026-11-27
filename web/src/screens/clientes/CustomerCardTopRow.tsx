/**
 * The card's own top row, directly under the shell's single back: right-aligned, one touch
 * target tall. The card draws it in every state but gone (so the content does not move when the
 * customer arrives); with `editTo` it holds the text link "Edit", without it the row is empty.
 */

import BotonLink from '../../components/BotonLink'
import { COMMON_TEXT } from '../../copy/common'

export default function CustomerCardTopRow({ editTo }: { editTo?: string }) {
  return (
    <div className="ficha-cliente__superior">
      {editTo !== undefined && (
        <BotonLink variant="link" to={editTo}>
          {COMMON_TEXT.edit}
        </BotonLink>
      )}
    </div>
  )
}
