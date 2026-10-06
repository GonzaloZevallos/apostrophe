/** The dialog half of the leave guard (`leaveGuard.ts`), over the app's one `ConfirmDialog`. */

import ConfirmDialog from '../components/ConfirmDialog'
import type { LeaveGuardState } from './leaveGuard'

export function LeaveGuard({ guard }: { guard: LeaveGuardState }) {
  if (!guard.asking) return null
  return (
    <ConfirmDialog
      title={guard.wording.title}
      detail={guard.wording.detail}
      confirmText={guard.wording.discardText}
      cancelText={guard.wording.stayText}
      onConfirm={guard.discard}
      onCancel={guard.stay}
    />
  )
}
