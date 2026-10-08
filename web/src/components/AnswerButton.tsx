/**
 * One answer of a confirmation: the words of a dialog are text only
 * (`icon-and-text-rule.md`, the dialog answers). It is the one place besides `Boton` that
 * draws `.boton`, because `Boton` has no text-only secondary or destructive that is not a
 * submit; `ConfirmDialog` and the two inline delete panels (an expense, a category) answer
 * through it, and `closingGuards.ts` lists this file as the dialog answers' author.
 */

export default function AnswerButton({
  kind,
  onClick,
  disabled = false,
  children,
}: {
  kind: 'keep' | 'confirm'
  onClick: () => void
  disabled?: boolean
  children: string
}) {
  return (
    <button
      type="button"
      className={kind === 'keep' ? 'boton boton--suave' : 'boton boton--destructivo'}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
