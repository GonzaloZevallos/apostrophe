/**
 * A success toast (PRD, "Feedback": a fixed string from the closed union, never
 * "Deshacer"). Blue, never green (accessibility rule: blue ↔ amber only) — `--acento`,
 * the same accent the rest of the app uses, not a state color of its own.
 *
 * `SuccessToast` is the PRD's own closed union ("Feedback": the full list of fixed
 * toasts) — every screen's toast state is typed on it, not on a bare `string`, so a
 * typo or an invented message fails `tsc` instead of rendering silently.
 */

export type SuccessToast =
  | 'Cliente guardado'
  | 'Variedad guardada'
  | 'Precio guardado'
  | 'Precio eliminado'
  | 'Gasto guardado'
  | 'Gasto eliminado'
  | 'Categoría guardada'
  | 'Categoría eliminada'
  | 'Negocio renombrado'
  | 'Invitación lista'
  | 'Cliente asignado'
  | 'Aviso guardado'
  | 'Catálogo guardado'
  | 'Catálogo copiado'
  | 'Cobro eliminado'

export default function AvisoExito({ texto }: { texto: SuccessToast }) {
  return (
    <div className="aviso-exito" role="status">
      <span className="aviso-exito__texto">{texto}</span>
    </div>
  )
}
