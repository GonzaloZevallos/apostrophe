/**
 * The "Cargando" state of `Estados`: the design's three skeleton shapes — a short
 * bar, a wider bar and two cards side by side — in the surface color, standing
 * where a screen's content will be. It takes no props and shows no text: a figure,
 * a placeholder amount or any word could be read as data (accounts.md, criterion 7).
 * Its name is for a screen reader only. Never `role="status"`: that role belongs to
 * toasts and notices.
 */

export default function Loading() {
  return (
    <div className="cargando" role="progressbar" aria-label="Cargando" aria-busy="true">
      <span className="cargando__barra cargando__barra--corta" />
      <span className="cargando__barra cargando__barra--ancha" />
      <div className="cargando__tarjetas">
        <span className="cargando__tarjeta" />
        <span className="cargando__tarjeta" />
      </div>
    </div>
  )
}
