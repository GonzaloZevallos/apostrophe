/**
 * One row of Variedades' list: a link to the variety's page. On a computer the page fills the
 * right pane, so picking a row replaces the history entry (back leaves the screen in one step,
 * not once per row looked at); on a phone it pushes one, and back returns to the list. The row
 * is the active one while the URL is that variety's page or anything under it.
 */

import { useMatch } from 'react-router'
import InAppLink from '../../components/InAppLink'

interface Props {
  to: string
  replace: boolean
  children: React.ReactNode
}

export default function VarietyRowLink({ to, replace, children }: Props) {
  const active = useMatch({ path: to, end: false }) !== null
  return (
    <InAppLink
      to={to}
      replace={replace}
      aria-current={active ? 'page' : undefined}
      className={active ? 'variedad-fila variedad-fila--activa' : 'variedad-fila'}
    >
      {children}
    </InAppLink>
  )
}
