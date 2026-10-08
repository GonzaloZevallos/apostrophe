/**
 * The "Usuarios" group of Configuración (`ConfiguracionUsuarios.dc.html`; `accounts.md`):
 * the business's users by email (sorted the way the backend already answers them), the
 * signed-in one marked "vos", and "Invitá a un socio".
 *
 * "Invitá a un socio" shows the fresh link right on the screen, which is why it gets no
 * toast of its own ("Invitación lista", unless the link is shown on the screen). A dropped
 * network shows "Sin conexión", never the generic retry. The group is never dirty: a link is
 * issued by the server the moment it is asked for, so there is nothing typed to lose.
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOutletContext } from 'react-router'
import { NetworkError, get, post } from '../../api/client'
import { keys } from '../../api/keys'
import type { Me } from '../../api/me'
import Boton from '../../components/Boton'
import ErrorGenerico from '../../components/ErrorGenerico'
import SinConexion from '../../components/SinConexion'
import Loading from '../../components/Loading'
import { copyText } from '../../clipboard'
import { canShare, shareText } from '../../share'
import { formatDateShort } from '../../format/dates'
import { inviteExpiry } from './messages'
import SettingsGroup from './SettingsGroup'

interface Business {
  users: { email: string }[]
}

interface Invite {
  url: string
  expires_at: string
}

const LEAVE = {
  question: '¿Descartás la invitación?',
  detail: 'Se pierde lo que cargaste: todavía no se guardó nada.',
  keepLabel: 'No, seguí editando',
  discardLabel: 'Sí, descartala',
}

export default function UsersGroup() {
  const me = useOutletContext<Me>()
  const { data, isPending, isError, error } = useQuery({
    queryKey: keys.business(),
    queryFn: () => get<Business>('/business'),
  })
  const [invite, setInvite] = useState<Invite | null>(null)
  const [invitePending, setInvitePending] = useState(false)
  const [inviteError, setInviteError] = useState(false)
  const [inviteOffline, setInviteOffline] = useState(false)

  async function onInvite(): Promise<void> {
    setInviteError(false)
    setInviteOffline(false)
    setInvitePending(true)
    try {
      setInvite(await post<Invite>('/invitations'))
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
    if (invite === null || !canShare()) return
    // `share.ts` is the only module that names the share sheet; a cancel and a failure
    // both stay silent here, the link is already readable right on the screen.
    await shareText(invite.url)
  }

  return (
    <SettingsGroup title="Usuarios" dirty={false} leave={LEAVE}>
      {isPending && <Loading />}
      {isError && (error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />)}
      {!isPending && !isError && (
        <ul className="usuarios__lista">
          {data.users.map((user) => (
            <li key={user.email} className="usuarios__usuario">
              <span>{user.email}</span>
              {user.email === me.email && <span className="usuarios__vos">vos</span>}
            </li>
          ))}
        </ul>
      )}
      <Boton variant="secondary" icon="personaMas" onClick={onInvite} disabled={invitePending}>
        Invitá a un socio
      </Boton>
      {invite !== null && (
        <div className="usuarios__invitacion">
          <div className="usuarios__link">{invite.url}</div>
          <div className="usuarios__acciones">
            <Boton variant="primary" icon="copiar" onClick={onCopy}>
              Copiar
            </Boton>
            <Boton variant="icon" action="share" ariaLabel="Compartir" onClick={onShare} />
          </div>
          <span className="campo__rotulo" data-copy="help">
            {inviteExpiry(formatDateShort(invite.expires_at.slice(0, 10)))}
          </span>
        </div>
      )}
      {inviteOffline && <SinConexion />}
      {inviteError && <ErrorGenerico />}
    </SettingsGroup>
  )
}
