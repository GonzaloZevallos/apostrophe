/**
 * "Invitá a un socio" (`ConfiguracionUsuarios.dc.html`; `accounts.md`), on its own so the
 * Configuración group and the Onboarding's partner step show the same thing: each tap is one
 * `POST /invitations`, and the fresh link shows right on the screen, which is why it gets no
 * toast of its own ("Invitación lista", unless the link is shown on the screen). A dropped
 * network shows "Sin conexión", never the generic retry. Nothing typed is held here, so
 * there is nothing to lose when the screen is left.
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
import { inviteExpiry } from '../../copy/settings'
import { COMMON_TEXT } from '../../copy/common'
import { STEP_SECOND_USER } from '../../copy/inicio'

interface Invite {
  url: string
  expires_at: string
}

/** The button that creates a link: its word and weight. The Onboarding's step 5 passes its own
 * ("Crear el link", primary); with none, Configuración → Usuarios keeps today's. */
export interface InviteAction {
  label: string
  variant: 'primary' | 'secondary'
}

const DEFAULT_ACTION: InviteAction = { label: STEP_SECOND_USER, variant: 'secondary' }

export default function InvitePartner({
  onLinkCreated,
  action = DEFAULT_ACTION,
}: {
  onLinkCreated: () => void
  action?: InviteAction
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
      <Boton variant={action.variant === 'primary' ? 'primary' : 'secondary'} icon="personaMas" onClick={onInvite} disabled={invitePending}>
        {action.label}
      </Boton>
      {invite !== null && (
        <div className="usuarios__invitacion">
          <div className="usuarios__link">{invite.url}</div>
          <div className="usuarios__acciones">
            <Boton variant="primary" icon="copiar" onClick={onCopy}>
              {COMMON_TEXT.copiar}
            </Boton>
            <Boton variant="icon" action="share" ariaLabel={COMMON_TEXT.compartir} onClick={onShare} />
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
