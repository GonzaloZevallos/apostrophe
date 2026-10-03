/**
 * The success toast (`componentes.ts`'s `Aviso`, `Estados.dc.html` "Avisos al
 * guardar"): one of the PRD's fixed strings, never a name, a phone number or an
 * amount (plan, invariants). `texto` is typed on the closed union so a screen
 * cannot toast anything else.
 */

export type SuccessToast =
  | 'Gasto guardado'
  | 'Gasto eliminado'
  | 'Categoría guardada'
  | 'Categoría eliminada'

export default function Aviso({ texto }: { texto: SuccessToast }) {
  return (
    <div className="aviso-flotante">
      <div className="aviso-toast" role="status">
        <span className="aviso-toast__texto">{texto}</span>
      </div>
    </div>
  )
}
