/**
 * Who draws the offline notice (`docs/product/offline-notice.md`). Root draws it on the phone
 * (in `.aviso-flotante`) and, on a computer, wherever there is no Shell (an in-flow row at
 * the top of the page). Shell draws it on a computer, as the first child of its content
 * column. The two agree through a slot: Root provides a store holding a Set of `useId`
 * tokens, Shell adds its token in a layout effect while it is mounted (at any width, so the
 * claim never depends on the viewport) and removes it in that effect's cleanup, which is
 * what keeps it right under StrictMode's mount, unmount, mount. Both read `useViewport`,
 * so a resize flips them in one commit and there is never zero or two notices.
 */

import { useState } from 'react'
import type { ReactNode } from 'react'
import SinConexion from '../components/SinConexion'
import { useOnline } from '../useOnline'
import { createSlotStore, SlotContext } from './useOfflineBannerSlot'

/** Created once by Root; the context value never changes, so a claim re-renders only its readers. */
export function OfflineBannerSlotProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createSlotStore)
  return <SlotContext.Provider value={store}>{children}</SlotContext.Provider>
}

/**
 * The one offline notice. `variant="flotante"` is the phone's, floating over the page in the
 * toasts' layer; `variant="pagina"` is the row at the top of a page that has no Shell; with no
 * variant it is the Shell's, the first child of its content column.
 */
export function OfflineBanner({ variant }: { variant?: 'flotante' | 'pagina' }) {
  const online = useOnline()
  if (online) return null
  const notice = (
    <div className={variant === 'pagina' ? 'aviso-sin-conexion aviso-sin-conexion--pagina' : 'aviso-sin-conexion'}>
      <SinConexion />
    </div>
  )
  return variant === 'flotante' ? <div className="aviso-flotante">{notice}</div> : notice
}
