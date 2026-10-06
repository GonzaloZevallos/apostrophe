/**
 * Which tab is active, decided here and nowhere else (navigation.md, "Active tab"):
 * both navs take `aria-current` and the non-colour mark from this one function, so no
 * component compares a pathname or reads `NavLink`'s own activity.
 *
 * The first segment decides. `/settings/**` marks Más, since Configuración is reached
 * from Más on the phone.
 */

import { paths } from '../routes/paths'

export type Tab = 'home' | 'sales' | 'customers' | 'varieties' | 'more' | 'expenses' | 'analysis'

function firstSegment(path: string): string {
  return path.split('/')[1] ?? ''
}

const BY_SEGMENT: Readonly<Record<string, Tab>> = {
  [firstSegment(paths.sales())]: 'sales',
  [firstSegment(paths.customers())]: 'customers',
  [firstSegment(paths.varieties())]: 'varieties',
  [firstSegment(paths.more())]: 'more',
  [firstSegment(paths.settings())]: 'more',
  [firstSegment(paths.expenses())]: 'expenses',
  [firstSegment(paths.analysis())]: 'analysis',
}

export function activeTab(pathname: string): Tab | null {
  if (pathname === paths.home()) return 'home'
  return BY_SEGMENT[firstSegment(pathname)] ?? null
}

/**
 * The phone bar has no Gastos or Análisis tab: they are reached through Más, so Más
 * is the bar's active entry on both. The sidebar keeps `activeTab`'s own answer.
 * Still a function of `activeTab`'s result alone: no width is read in JavaScript.
 */
export function barTab(tab: Tab | null): Tab | null {
  return tab === 'expenses' || tab === 'analysis' ? 'more' : tab
}
