/**
 * Configuración → Usuarios (`accounts.md`): the business's users by email (sorted the
 * way the backend already answers them), the signed-in one marked "vos", and "Invitá a
 * un socio". Today's piece, unchanged.
 *
 * "Invitá a un socio" shows the fresh link right on the screen, in the design's own
 * words ("Un link de un solo uso, vence el …"), which is why it gets no toast of its
 * own. A dropped network shows "Sin conexión", never the generic retry.
 */

import { useState } from 'react'
import { useOutletContext } from 'react-router'
import { NetworkError, post } from '../../api/client'
import type { Me } from '../../api/me'
import { copyText } from '../../clipboard'
import ErrorGenerico from '../../components/ErrorGenerico'
import SinConexion from '../../components/SinConexion'
import { formatDateShort } from '../../format/dates'
import { useBusiness } from './business'

interface Invite {
  url: string
  expires_at: string
}

export default function UsuariosGrupo() {
  const me = useOutletContext<Me>()
  const { data, isPending, isError, error } = useBusiness()

  const [invite, setInvite] = useState<Invite | null>(null)
  const [invitePending, setInvitePending] = useState(false)
  const [inviteError, setInviteError] = useState(false)
  const [inviteOffline, setInviteOffline] = useState(false)

  if (isPending) return <main className="pantalla" />

  if (isError) {
    return (
      <main className="pantalla">
        <div className="cuerpo">
          {error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />}
        </div>
      </main>
    )
  }

  async function onInvite(): Promise<void> {
    setInviteError(false)
    setInviteOffline(false)
    setInvitePending(true)
    try {
      const issued = await post<Invite>('/invitations')
      setInvite(issued)
    } catch (caught) {
      if (caught instanceof NetworkError) {
        setInviteOffline(true)
      } else {
        setInviteError(true)
      }
    } finally {
      setInvitePending(false)
    }
  }

  async function onCopy(): Promise<void> {
    if (invite === null) return
    // A failed copy (or the home network's plain http, ADR-0002) stays silent
    // here: the link is already readable right on the screen.
    await copyText(invite.url)
  }

  async function onShare(): Promise<void> {
    if (invite === null || typeof navigator.share !== 'function') return
    try {
      await navigator.share({ url: invite.url })
    } catch {
      // Cancelling the phone's share sheet rejects the promise; that is not a
      // failure worth a message of its own.
    }
  }

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <span className="encabezado__titulo">Usuarios</span>

        <div className="negocio__usuarios">
          <span className="campo__rotulo">Usuarios</span>
          <ul className="negocio__lista">
            {data.users.map((user) => (
              <li key={user.email} className="negocio__usuario">
                <span>{user.email}</span>
                {user.email === me.email && <span className="negocio__vos">vos</span>}
              </li>
            ))}
          </ul>
        </div>

        <div className="negocio__invitar">
          <span className="campo__rotulo">Invitá a un socio</span>
          <button className="boton" type="button" onClick={onInvite} disabled={invitePending}>
            Invitá a un socio
          </button>
          {invite !== null && (
            <>
              <div className="negocio__link">{invite.url}</div>
              <div className="negocio__acciones">
                <button type="button" className="boton" onClick={onCopy}>
                  Copiar
                </button>
                <button type="button" className="boton" onClick={onShare}>
                  Compartir
                </button>
              </div>
              <span className="campo__rotulo">
                Un link de un solo uso, vence el {formatDateShort(invite.expires_at.slice(0, 10))}
              </span>
            </>
          )}
          {inviteOffline && <SinConexion />}
          {inviteError && <ErrorGenerico />}
        </div>
      </div>
    </main>
  )
}
