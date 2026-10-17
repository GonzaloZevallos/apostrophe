/**
 * One row of a two-pane list (Variedades, Archivadas, Clientes): a link to the record's page.
 * On a computer the page fills the right pane, so picking a row replaces the history entry
 * (back leaves the screen in one step, not once per row looked at); on a phone it pushes one,
 * and back returns to the list. The row is the active one while the URL is that record's page
 * or anything under it.
 */

import { useMatch } from 'react-router'
import InAppLink from './InAppLink'

interface Props {
  to: string
  replace: boolean
  className: string
  activeClassName: string
  children: React.ReactNode
}

export default function PaneRowLink({ to, replace, className, activeClassName, children }: Props) {
  const active = useMatch({ path: to, end: false }) !== null
  return (
    <InAppLink
      to={to}
      replace={replace}
      aria-current={active ? 'page' : undefined}
      className={active ? activeClassName : className}
    >
      {children}
    </InAppLink>
  )
}
