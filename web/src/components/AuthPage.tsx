/**
 * The one page every getting-in screen renders through (ADR-0025): a single centred,
 * phone-width column on every viewport, with no per-screen or computer-only variant.
 * `eyebrow` is the small line above the title (Invitacion's "Te invitaron a").
 * `title` is optional only so a screen still waiting on its lookup (`Loading`) or
 * showing a shared state (`SinConexion`, `ErrorGenerico`) sits in the same column
 * without a heading that would read as data before it is known. `brand` draws the lockup
 * (mark and wordmark) at the top of the column; off by default, so a screen that is only
 * waiting or failing shows none.
 */

import type { ReactNode } from 'react'
import BrandMark from './BrandMark'

export default function AuthPage({
  brand = false,
  eyebrow,
  title,
  titleClass,
  subtitle,
  children,
}: {
  brand?: boolean
  eyebrow?: string
  title?: string
  titleClass?: string
  subtitle?: string
  children?: ReactNode
}) {
  return (
    <main className="pantalla auth-page">
      <div className="auth-page__columna">
        {brand && <BrandMark variant="lockup" />}
        {title !== undefined && (
          <div>
            {eyebrow !== undefined && <span className="auth-page__pastilla">{eyebrow}</span>}
            <h1 className={titleClass === undefined ? 'auth-page__titulo' : `auth-page__titulo ${titleClass}`}>{title}</h1>
            {subtitle !== undefined && <p className="subtitulo">{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    </main>
  )
}
