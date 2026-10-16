/**
 * The "‹ <parent>" arrow every card shows, and the only place the app draws one. The word is
 * the screen's fixed parent, from `parentOf(id, viewport)`; tapping it goes back through
 * history when the entry is in-app, and to that same parent (replacing the entry) when it is
 * not (`useBackOr`). The label and the fallback are one registry answer, so they cannot
 * disagree, and the fallback's path template is filled with the leaf's route params, so it is
 * never a literal `:id`. The accessible name is the visible text, nothing else.
 *
 * A leaf the registry marks `backLabel: 'record'` (a variety's page, its prices, its entries)
 * names a word only the loaded record knows. It draws only an override its screen declared
 * through `useBackParent` for this very screen and route param, and nothing before: no "‹"
 * alone, no registry word standing in for the record.
 */

import { useContext } from 'react'
import { useParams } from 'react-router'
import Boton from '../components/Boton'
import { useBackOr } from '../components/useBackOr'
import { HOME, parentOf, pathTo, screenOf, type ScreenId } from '../routes'
import { BackParentContext, type BackOverride } from './useBackParent'
import { useViewport } from './useViewport'

/** The route params that carry a value; `useParams` types the missing ones as `undefined`. */
function filled(params: Readonly<Record<string, string | undefined>>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params).flatMap(([name, value]) => (value === undefined ? [] : [[name, value]])),
  )
}

interface Target {
  path: string
  title: string
}

/** Where a declared override points: another screen (its path and word), or the registry
 * parent's path under a new visible word. */
function targetOf(declared: BackOverride, registryPath: string | undefined): Target | undefined {
  if ('parent' in declared) {
    const parent = screenOf(declared.parent)
    return { path: parent.path, title: parent.title }
  }
  return registryPath === undefined ? undefined : { path: registryPath, title: declared.title }
}

export default function BackArrow({ id }: { id: ScreenId }) {
  const params = filled(useParams())
  const slot = useContext(BackParentContext)?.slot
  const registryParent = parentOf(id, useViewport())
  const registryPath = registryParent === undefined ? undefined : pathTo(registryParent.path, params)
  const declared = slot !== undefined && slot.screen === id && slot.param === params.id ? slot.override : undefined
  const override = declared === undefined ? undefined : targetOf(declared, registryPath)
  const back = useBackOr(override?.path ?? registryPath ?? HOME)
  const word = screenOf(id).backLabel === 'record' ? override?.title : registryParent?.title
  if (word === undefined) return null
  return (
    <div className="flecha-atras">
      <Boton variant="back" onClick={back}>
        {`‹ ${word}`}
      </Boton>
    </div>
  )
}
