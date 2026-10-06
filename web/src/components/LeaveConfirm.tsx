/**
 * The confirmation a leave guard shows when it blocks a navigation. The caller gives its
 * own fixed wording; discarding lets the navigation through, keeping cancels it.
 */

import type { Blocker } from 'react-router'
import ConfirmDialog from './ConfirmDialog'

export interface LeaveConfirmProps {
  blocker: Blocker
  question: string
  detail: string
  keepLabel: string
  discardLabel: string
}

export default function LeaveConfirm({
  blocker,
  question,
  detail,
  keepLabel,
  discardLabel,
}: LeaveConfirmProps) {
  return (
    <ConfirmDialog
      title={question}
      detail={detail}
      confirmText={discardLabel}
      cancelText={keepLabel}
      onConfirm={() => blocker.state === 'blocked' && blocker.proceed()}
      onCancel={() => blocker.state === 'blocked' && blocker.reset()}
    />
  )
}
