/**
 * The "Antes de borrar" pattern (`varieties.md`, `expenses.md`): a fixed shape for
 * every destructive confirmation in the app — title, a detail line that says what the
 * action undoes or what takes its place, and "No, dejá…" / "Sí, borrá…" buttons. No
 * screen builds its own dialog markup.
 */

export interface ConfirmDialogProps {
  title: string
  detail: string
  confirmText: string
  cancelText: string
  onConfirm: () => void
  onCancel: () => void
}

/** One answer of the pair: the words of a confirmation are text only (`icon-and-text-rule.md`,
 * the dialog answers). Unexported on purpose: no screen draws its own answer, and `Boton`
 * does not offer a text-only secondary or destructive one. */
function AnswerButton({
  kind,
  onClick,
  children,
}: {
  kind: 'keep' | 'confirm'
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      className={kind === 'keep' ? 'boton boton--suave' : 'boton boton--destructivo'}
      onClick={onClick}
    >
      {children}
    </button>
  )
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
