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

interface Business {
  users: { email: string }[]
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
      <InvitePartner onLinkCreated={() => undefined} />
    </SettingsGroup>
  )
}
