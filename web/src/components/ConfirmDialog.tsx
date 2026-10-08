/**
 * The "Antes de borrar" pattern (`varieties.md`, `expenses.md`): a fixed shape for
 * every destructive confirmation in the app — title, a detail line that says what the
 * action undoes or what takes its place, and "No, dejá…" / "Sí, borrá…" buttons. No
 * screen builds its own dialog markup.
 */

import AnswerButton from './AnswerButton'

export interface ConfirmDialogProps {
  title: string
  detail: string
  confirmText: string
  cancelText: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  title,
  detail,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="confirmacion" role="alertdialog" aria-modal="true" aria-label={title}>
      <span className="confirmacion__titulo">{title}</span>
      <span className="confirmacion__detalle">{detail}</span>
      <div className="confirmacion__acciones">
        <AnswerButton kind="keep" onClick={onCancel}>
          {cancelText}
        </AnswerButton>
        <AnswerButton kind="confirm" onClick={onConfirm}>
          {confirmText}
        </AnswerButton>
      </div>
    </div>
  )
}
