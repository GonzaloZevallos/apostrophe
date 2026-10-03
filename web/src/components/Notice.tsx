/**
 * The fixed feedback banners after a write (plan, "Gone records" and "Feedback"):
 * a success toast (the closed union a screen passes in `message`) or the gone
 * notice (`GONE_NOTICE`, from `refusals.ts`). Neither carries an id, name, date or
 * amount; both are announced the same way, with no "Deshacer" and no "Reintentar".
 * `kind` only changes the colour token used (`--boton`/`--boton-texto` for a
 * success toast, the amber `aviso-ambar` for the gone notice), never a loose hex.
 */

export default function Notice({ kind, message }: { kind: 'toast' | 'notice'; message: string }) {
  return (
    <div className={kind === 'toast' ? 'toast' : 'aviso-ambar'} role="status">
      <span className={kind === 'toast' ? 'toast__texto' : 'aviso-ambar__titulo'}>{message}</span>
    </div>
  )
}
