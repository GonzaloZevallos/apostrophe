/**
 * A success toast (PRD, "Feedback": a fixed string from a copy section, never
 * "Undo"). Blue, never green (accessibility rule: blue ↔ amber only) — `--acento`,
 * the same accent the rest of the app uses, not a state color of its own.
 *
 */

import type { SuccessToast } from '../copy/common.ts'

export type { SuccessToast }

export default function AvisoExito({ texto }: { texto: SuccessToast }) {
  return (
    <div className="aviso-exito" role="status">
      <span className="aviso-exito__texto">{texto}</span>
    </div>
  )
}
