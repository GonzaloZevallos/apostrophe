/**
 * A success toast (PRD, "Feedback": a fixed string from a copy section, never
 * "Undo"). Blue, never green (accessibility rule: blue ↔ amber only) — `--acento`,
 * the same accent the rest of the app uses, not a state color of its own.
 *
 */

/** A toast's text comes from a section of `copy/`; the visible-literal guard (ADR-0049) keeps a
 * screen from writing one of its own, which is what the closed union used to prevent. */
export type SuccessToast = string

export default function AvisoExito({ texto }: { texto: SuccessToast }) {
  return (
    <div className="aviso-exito" role="status">
      <span className="aviso-exito__texto">{texto}</span>
    </div>
  )
}
