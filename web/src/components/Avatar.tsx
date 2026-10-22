/**
 * A person's initials in a circle (`ClientesCompu.dc.html`): decorative, the name is always
 * written beside it, so it is hidden from assistive technology. Its letters come from
 * `initialsOf`, its fill from `--superficie` (`--papel` on a selected row), and it sets no
 * colour of its own.
 */

import { initialsOf } from '../format/initials'

interface Props {
  name: string
}

export default function Avatar({ name }: Props) {
  return (
    <span className="avatar" aria-hidden="true">
      {initialsOf(name)}
    </span>
  )
}
