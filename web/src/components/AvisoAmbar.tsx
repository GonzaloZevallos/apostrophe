/**
 * `AvisoAmbar`: the amber notice box (`.aviso-ambar`) the app draws for a state a person
 * must read: the stale pinned catalog, "Out of date", "Sin conexión", the server-error
 * retry. With `attention`, the one `atencion` icon sits beside its sentence, decorative
 * (`aria-hidden`, in `currentColor`): the sentence and the colour still carry the state
 * (`docs/product/icon-and-text-rule.md`, "Notices"). Informational notices ("Up to date", "Eso ya
 * no está.", toasts) never pass it.
 */

import type { ReactNode } from 'react'
import Icono from './Icono'

export interface AvisoAmbarProps {
  attention?: boolean
  role?: 'status' | 'alert'
  className?: string
  children: ReactNode
}

export default function AvisoAmbar({ attention = false, role, className, children }: AvisoAmbarProps) {
  return (
    <div className={['aviso-ambar', attention ? 'aviso-ambar--atencion' : '', className ?? ''].join(' ').trim()} role={role}>
      <AvisoCuerpo attention={attention}>{children}</AvisoCuerpo>
    </div>
  )
}

/** The icon and the text column, for a notice whose box is not a `div` (a link). */
export function AvisoCuerpo({ attention, children }: { attention: boolean; children: ReactNode }) {
  if (!attention) return <>{children}</>
  return (
    <>
      <span className="aviso-ambar__icono">
        <Icono nombre="atencion" />
      </span>
      <span className="aviso-ambar__cuerpo">{children}</span>
    </>
  )
}
