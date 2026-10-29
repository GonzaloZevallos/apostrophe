import { useTranslation } from 'react-i18next'
/**
 * The "Cargando" state of `Estados`: the design's three skeleton shapes — a short
 * bar, a wider bar and two cards side by side — in the surface color, standing
 * where a screen's content will be. It takes no props and shows no text: a figure,
 * a placeholder amount or any word could be read as data (accounts.md, criterion 7).
 * Its name is for a screen reader only. Never `role="status"`: that role belongs to
 * toasts and notices.
 *
 * `compacto` is the opt-in marker for one figure that is waiting (a line's price, the
 * footer's total during a date change): only the short bar, `aria-hidden`, no role and
 * no text, so it never adds a second progressbar. `LoadingAnuncio` is the one visually
 * hidden progressbar a screen announces itself with while those markers are on.
 */

export interface LoadingProps {
  compacto?: boolean
}

export function LoadingAnuncio() {
  const { t } = useTranslation()
  return <div className="cargando__anuncio" role="progressbar" aria-label={t('common:loading')} aria-busy="true" />
}

export default function Loading({ compacto = false }: LoadingProps) {
  const { t } = useTranslation()
  if (compacto) {
    return (
      <span className="cargando cargando--compacto" aria-hidden="true">
        <span className="cargando__barra cargando__barra--corta" />
      </span>
    )
  }
  return (
    <div className="cargando" role="progressbar" aria-label={t('common:loading')} aria-busy="true">
      <span className="cargando__barra cargando__barra--corta" />
      <span className="cargando__barra cargando__barra--ancha" />
      <div className="cargando__tarjetas">
        <span className="cargando__tarjeta" />
        <span className="cargando__tarjeta" />
      </div>
    </div>
  )
}
