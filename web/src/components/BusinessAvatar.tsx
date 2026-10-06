/**
 * The business's circle: its initials on the soft accent (`Inicio.dc.html`, the
 * avatar at the top; `InicioCompu.dc.html`, the sidebar's business row). Decorative:
 * the link around it carries the name ("Configuración de <business>").
 */

import { initialsOf } from '../shell/initials'

export default function BusinessAvatar({ name, className }: { name: string; className: string }) {
  return (
    <span className={className} aria-hidden="true">
      {initialsOf(name)}
    </span>
  )
}
