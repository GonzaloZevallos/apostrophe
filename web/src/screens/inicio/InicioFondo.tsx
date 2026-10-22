/**
 * Home as the background under Record payment (ADR-0044, GH-281): `InicioPanel` alone, on
 * Today, from the same frozen panel read `Inicio` uses. It is presentational: it reads
 * nothing but the panel (no first-run, onboarding or pinned-catalog status, so nothing is
 * stamped or offered, ADR-0046), runs no focus, title or navigation effect, and its tab
 * switch does nothing. While the panel loads, or when it fails, it draws nothing: the sheet
 * covers it on the phone and the scrim on the computer. The caller sets `inert` and
 * `aria-hidden` on whatever wraps it.
 */

import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOutletContext } from 'react-router'
import { panelQuery } from '../../api/panel'
import type { Me } from '../../api/me'
import { owedPlace, useReturnToPlace } from '../../components/useReturnToPlace'
import InicioPanel from './InicioPanel'

function ignoreTab(): void {
  // The background is not interactive: a tab switch has nowhere to go.
}

export default function InicioFondo() {
  const me = useOutletContext<Me>()
  const panel = useQuery(panelQuery)

  // Under the sheet it only puts the page where the seller was; it never takes the hand-off.
  const root = useRef<HTMLElement>(null)
  useReturnToPlace({ root, ready: panel.data !== undefined && !panel.isFetching, owns: false, fallback: owedPlace })

  if (panel.data === undefined) return null
  return <InicioPanel panel={panel.data} tab="today" onTab={ignoreTab} today={me.today} />
}
