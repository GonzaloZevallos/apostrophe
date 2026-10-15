/**
 * A record-labelled card's back word (`routes.ts`, `backLabel: 'record'`): a variety's page
 * says "‹ Variedades" or "‹ Archivadas", its prices and entries say "‹ <the variety's name>".
 * The word is known only once the record has loaded, so the screen declares it here and
 * `BackArrow` draws it; until then the leaf shows no back at all.
 *
 * Shell owns one slot (`BackParentContext`). The hook writes `{ screen, param, override }` into
 * it in a layout effect, never during render, and its cleanup clears the slot only when the
 * slot is still its own, so a late cleanup never wipes the next record's label. `BackArrow`
 * uses an override only when its screen and param are the current leaf's.
 *
 * `screen` is typed `RecordLabelledScreen`: a call from an unmarked screen does not compile
 * (`useBackParent.types.test.ts`), so no runtime check stands in for it.
 */

import { createContext, useContext, useLayoutEffect } from 'react'
import { useParams } from 'react-router'
import type { RecordLabelledScreen } from '../routes'

/** The archived variety's parent is another screen; any other record shows its name. */
export type BackOverride = { parent: 'varieties-archived' } | { title: string }

export interface BackParentSlot {
  screen: RecordLabelledScreen
  /** The route's `:id` the override was declared for. */
  param: string | undefined
  override: BackOverride
}

export interface BackParentStore {
  slot: BackParentSlot | undefined
  write: (next: BackParentSlot) => void
  /** Clears the slot only if it still holds this screen and param. */
  clearIf: (own: Pick<BackParentSlot, 'screen' | 'param'>) => void
}

export const BackParentContext = createContext<BackParentStore | undefined>(undefined)

export function useBackParent(screen: RecordLabelledScreen, override: BackOverride): void {
  const store = useContext(BackParentContext)
  const param = useParams<{ id: string }>().id
  // The effect depends on the override's primitives, so a fresh object each render re-writes nothing.
  const parent = 'parent' in override ? override.parent : undefined
  const title = 'title' in override ? override.title : undefined
  const write = store?.write
  const clearIf = store?.clearIf
  useLayoutEffect(() => {
    if (write === undefined || clearIf === undefined) return undefined
    write({ screen, param, override: parent === undefined ? { title: title ?? '' } : { parent } })
    return () => clearIf({ screen, param })
  }, [write, clearIf, screen, param, parent, title])
}
