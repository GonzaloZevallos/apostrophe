/**
 * The "Usuarios" group of Configuración (`ConfiguracionUsuarios.dc.html`; `accounts.md`):
 * the business's users by email (sorted the way the backend already answers them), the
 * signed-in one marked "vos", and "Invitá a un socio".
 *
 * "Invitá a un socio" is `InvitePartner` (shared with the Onboarding's partner step). The group
 * is never dirty: a link is issued by the server the moment it is asked for, so there is
 * nothing typed to lose.
 */

import { useQuery } from '@tanstack/react-query'
import { useOutletContext } from 'react-router'
import { NetworkError, get } from '../../api/client'
import { keys } from '../../api/keys'
import type { Me } from '../../api/me'
import ErrorGenerico from '../../components/ErrorGenerico'
import SinConexion from '../../components/SinConexion'
import Loading from '../../components/Loading'
import InvitePartner from './InvitePartner'
import SettingsGroup from './SettingsGroup'
import { SETTINGS_TEXT } from '../../copy/settings'
import { COMMON_TEXT } from '../../copy/common'

interface Business {
  users: { email: string }[]
}

const LEAVE = {
  question: SETTINGS_TEXT.descartasLaInvitacion,
  detail: COMMON_TEXT.sePierdeLoQue,
  keepLabel: COMMON_TEXT.noSeguiEditando,
  discardLabel: COMMON_TEXT.siDescartala,
}

export default function UsersGroup() {
  const me = useOutletContext<Me>()
  const { data, isPending, isError, error } = useQuery({
    queryKey: keys.business(),
    queryFn: () => get<Business>('/business'),
  })

  return (
    <SettingsGroup title={COMMON_TEXT.usuarios} dirty={false} leave={LEAVE}>
      {isPending && <Loading />}
      {isError && (error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />)}
      {!isPending && !isError && (
        <ul className="usuarios__lista">
          {data.users.map((user) => (
            <li key={user.email} className="usuarios__usuario">
              <span>{user.email}</span>
              {user.email === me.email && <span className="usuarios__vos">{SETTINGS_TEXT.vos}</span>}
            </li>
          ))}
        </ul>
      )}
      <InvitePartner onLinkCreated={() => undefined} />
    </SettingsGroup>
  )
}
