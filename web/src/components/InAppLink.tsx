/**
 * A `Link` that says the entry it opens has the app behind it (`state: { inApp: true }`), which
 * is what lets `useBackOr` go through history from a card or form instead of replacing the
 * entry with the parent. Every in-app link into a card or a form goes through it; a link that
 * needs more state (a sale prefilled for a customer) merges it in with `state`.
 */

import { Link, type LinkProps } from 'react-router'

export default function InAppLink({ state, ...props }: LinkProps) {
  const extra: object = typeof state === 'object' && state !== null ? state : {}
  return <Link {...props} state={{ ...extra, inApp: true }} />
}
