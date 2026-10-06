/**
 * A sheet that is not a route (Registrar cobro, Elegir cliente, a variety's rename and
 * price form, the password sheet): a fixed full-viewport overlay above the bar and
 * "+ Nueva venta", so a sheet shows no chrome (`navigation.md`, "Chrome and back").
 * "Cerrar" goes through the leave guard when the sheet has one, so a touched sheet asks
 * first and an untouched one closes at once; without a `guard` it just closes.
 */

import type { ReactNode } from 'react'
import { type LeaveGuardState, useLeaveGuard, useTouched, type Wording } from '../shell/leaveGuard'
import { LeaveGuard } from '../shell/LeaveGuardDialog'
import Boton from './Boton'

export interface SheetProps {
  title: string
  onClose: () => void
  guard?: LeaveGuardState
  /** `customer`: "Elegir cliente"'s own layer, with its grab handle (`NuevaVentaCliente.dc.html`). */
  look?: 'default' | 'customer'
  children: ReactNode
}

export default function Sheet({ title, onClose, guard, look = 'default', children }: SheetProps) {
  const customer = look === 'customer'
  return (
    <div className={customer ? 'cliente-sheet' : 'capa'} role="presentation">
      <div className={customer ? 'cliente-sheet__contenido' : 'capa__contenido'}>
        {customer && <span className="cliente-sheet__manija" aria-hidden="true" />}
        <div className="cliente-sheet__encabezado">
          <span className="panel__titulo">{title}</span>
          <Boton variant="link" onClick={() => (guard ? guard.requestClose(onClose) : onClose())}>
            Cerrar
          </Boton>
        </div>
        {children}
        {guard !== undefined && <LeaveGuard guard={guard} />}
      </div>
    </div>
  )
}

/** A sheet whose own `values` are the form: it captures them when it opens and asks
 * before closing once they differ. For a sheet that closes by state (no navigation
 * after a save), so it needs no `allowLeave`. */
export function GuardedSheet({
  values,
  wording,
  ...rest
}: Omit<SheetProps, 'guard'> & { values: unknown; wording?: Wording }) {
  const guard = useLeaveGuard({ touched: useTouched(values), wording })
  return <Sheet {...rest} guard={guard} />
}
