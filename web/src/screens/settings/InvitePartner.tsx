/**
 * "Invitá a un socio" (`ConfiguracionUsuarios.dc.html`; `accounts.md`), on its own so the
 * Configuración group and the Onboarding's partner step show the same thing: each tap is one
 * `POST /invitations`, and the fresh link shows right on the screen, which is why it gets no
 * toast of its own ("Invitación lista", unless the link is shown on the screen). A dropped
 * network shows "Sin conexión", never the generic retry. Nothing typed is held here, so
 * there is nothing to lose when the screen is left.
 *
 * `action` is only the word and weight of the one button: `'invite'` (default) is the soft
 * "Invitá a un socio"; `'createLink'` is the Onboarding's primary "Crear el link"
 * (`OnboardingSocio.dc.html`). Either way a tap is one `POST /invitations`.
 *
 * `onLinkCreated` tells the parent a link now exists; the link itself stays here and is never
 * logged or stored in the browser.
 */

import { useState } from 'react'
import { NetworkError, post } from '../../api/client'
import Boton from '../../components/Boton'
import ErrorGenerico from '../../components/ErrorGenerico'
import SinConexion from '../../components/SinConexion'
import { copyText } from '../../clipboard'
import { canShare, shareText } from '../../share'
import { formatDateShort } from '../../format/dates'
import { inviteExpiry } from './messages'

interface Invite {
  url: string
  expires_at: string
}

export default function InvitePartner({
  onLinkCreated,
  action = 'invite',
}: {
  onLinkCreated: () => void
  action?: 'invite' | 'createLink'
}) {
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
      onLinkCreated()
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
    <>
      <Boton
        variant={action === 'createLink' ? 'primary' : 'secondary'}
        icon="personaMas"
        onClick={onInvite}
        disabled={invitePending}
      >
        {action === 'createLink' ? 'Crear el link' : 'Invitá a un socio'}
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
    </>
  )
}
