/**
 * One row of a two-pane list (Variedades, Archivadas, Clientes, Te deben): a link to the
 * record's page. On a computer the page fills the right pane, so picking a row replaces the
 * history entry (back leaves the screen in one step, not once per row looked at); on a phone
 * it pushes one, and back returns to the list. The one place that decides it. It renders
 * through `InAppLink`, so both branches carry the in-app state. The row is the active one
 * while the URL is that record's path or anything under it.
 */

import { useMatch } from 'react-router'
import { useViewport } from '../shell/useViewport'
import InAppLink from './InAppLink'

interface Props {
  to: string
  /** The row's class names. */
  className: string
  /** The row's class names while it is the active one. */
  activeClassName: string
  children: React.ReactNode
}

export default function PaneRowLink({ to, className, activeClassName, children }: Props) {
  const active = useMatch({ path: to, end: false }) !== null
  return (
    <InAppLink
      to={to}
      replace={useViewport() === 'computer'}
      aria-current={active ? 'page' : undefined}
      className={active ? activeClassName : className}
    >
      {children}
    </InAppLink>
  )
}
