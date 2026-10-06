/**
 * The one page every getting-in screen renders through (ADR-0024): a single centred,
 * phone-width column on every viewport, with no per-screen or computer-only variant.
 * `eyebrow` is the small line above the title (Invitacion's "Te invitaron a").
 * `title` is optional only so a screen still waiting on its lookup (`Loading`) or
 * showing a shared state (`SinConexion`, `ErrorGenerico`) sits in the same column
 * without a heading that would read as data before it is known.
 */

import type { ReactNode } from 'react'

export default function AuthPage({
  eyebrow,
  title,
  titleClass,
  subtitle,
  children,
}: {
  eyebrow?: string
  title?: string
  titleClass?: string
  subtitle?: string
  children?: ReactNode
}) {
  return (
    <main className="pantalla auth-page">
      <div className="auth-page__columna">
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
