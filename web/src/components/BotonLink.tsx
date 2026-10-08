/**
 * `BotonLink`: `Boton`'s union drawn as an in-app link (`InAppLink` underneath, so the
 * entry it opens knows the app is behind it) for an action that navigates: "Mandar
 * catálogo", "+ Entrada de stock", "Sacar del stock". Every shape of `Boton` but the
 * submit, since a link submits nothing; the same classes, the same icon-hidden rule, the
 * same closed icon-only map.
 */

import type { LinkProps } from 'react-router'
import type { BotonVisualProps } from './Boton'
import { botonVisual } from './botonVisual'
import InAppLink from './InAppLink'

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

export type BotonLinkProps = DistributiveOmit<BotonVisualProps, 'disabled' | 'type'> &
  Pick<LinkProps, 'to' | 'replace' | 'state'> & {
    /** Placement only (a margin, a fixed position): never a button look of its own. */
    className?: string
  }

export default function BotonLink(props: BotonLinkProps) {
  const { className, ariaLabel, content } = botonVisual({ ...props, disabled: false })
  return (
    <InAppLink
      to={props.to}
      replace={props.replace}
      state={props.state}
      className={props.className === undefined ? className : `${className} ${props.className}`}
      onClick={props.onClick}
      aria-label={ariaLabel}
      aria-describedby={props.ariaDescribedBy}
    >
      {content}
    </InAppLink>
  )
}
