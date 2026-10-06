/**
 * The one page every getting-in screen renders through (ADR-0024): a single centred,
 * phone-width column on every viewport, with no per-screen or computer-only variant.
 * `title` is optional only so a screen still waiting on its lookup (`Loading`) or
 * showing a shared state (`SinConexion`, `ErrorGenerico`) sits in the same column
 * without a heading that would read as data before it is known.
 */

import type { ReactNode } from 'react'

export default function AuthPage({
  title,
  subtitle,
  children,
}: {
  title?: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <main className="pantalla auth-page">
      <div className="auth-page__columna">
        {title !== undefined && (
          <div>
            <h1 className="auth-page__titulo">{title}</h1>
            {subtitle !== undefined && <p className="subtitulo">{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    </main>
  )
}
