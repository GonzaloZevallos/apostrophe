/**
 * The "Antes de borrar" pattern (`varieties.md`, `expenses.md`): a fixed shape for
 * every destructive confirmation in the app — title, a detail line that says what the
 * action undoes or what takes its place, and "No, dejá…" / "Sí, borrá…" buttons. No
 * screen builds its own dialog markup.
 */

import { useId, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useMoney } from '../format/moneyContext'
import { useViewport } from '../shell/useViewport'
import AnswerButton from './AnswerButton'
import { useConfirmLayer } from './confirmLayerContext'

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
  const money = useMoney()
  const layer = useConfirmLayer()
  const phone = useViewport() === 'phone'
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const inLayer = phone && layer?.host != null

  // On the phone the layer owns the lock and the inert: register on mount, release on every unmount.
  useLayoutEffect(() => {
    if (!inLayer || !layer || !root.current) return
    layer.register(id, root.current)
    return () => layer.release(id)
  }, [inLayer, layer, id])

  const dialog = (
    <div ref={root} className="confirmacion" role="alertdialog" aria-modal="true" aria-label={title}>
      <span className="confirmacion__texto">
        <span className="confirmacion__titulo">{money.keepTogether(title)}</span>
        <span className="confirmacion__detalle">{money.keepTogether(detail)}</span>
      </span>
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
  return inLayer && layer?.host ? createPortal(dialog, layer.host) : dialog
}
