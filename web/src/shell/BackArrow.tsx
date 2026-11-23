/**
 * The "‹ <parent>" arrow every card shows, and the only place the app draws one. Tapping it goes
 * back through history when the entry is in-app, and to the same parent (replacing the entry)
 * when it is not (`useBackOr`). The label and the fallback are one answer, so they cannot
 * disagree: the entry parent when `entryParentOf` answers (the screen was opened from the screen
 * its table names, read from the location's `enteredFrom`), the registry parent
 * (`parentOf(id, viewport)`) otherwise. The fallback's path template is filled with the leaf's
 * route params, so it is never a literal `:id`. The accessible name is the visible text, nothing
 * else.
 *
 * Precedence: a declared record override (`useBackParent`) wins over everything; the entry parent
 * applies only when none is declared; the registry parent is the last answer.
 *
 * A leaf the registry marks `backLabel: 'record'` (a variety's page, its prices, its entries)
 * names a word only the loaded record knows. It draws only an override its screen declared
 * through `useBackParent` for this very screen and route param, and nothing before: no "‹"
 * alone, no registry word standing in for the record.
 */

import { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router'
import Boton from '../components/Boton'
import { useBackOr } from '../components/useBackOr'
import { useLabel, type Label } from '../i18n/label'
import { HOME, entryParentOf, parentOf, pathTo, screenOf, type ScreenId } from '../routes'
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
  /** A registry word is a key; a record's own name is text and is never read as a key. */
  title: Label
}

/** Where a declared override points: another screen (its path and word), or the registry
 * parent's path under a new visible word. */
function targetOf(declared: BackOverride, registryPath: string | undefined): Target | undefined {
  if ('parent' in declared) {
    const parent = screenOf(declared.parent)
    return { path: parent.path, title: { kind: 'key', key: parent.titleKey } }
  }
  return registryPath === undefined ? undefined : { path: registryPath, title: { kind: 'text', text: declared.title } }
}

/** Where the entry was opened from, as the location's state carries it; anything else is `undefined`. */
function enteredFromOf(state: unknown): unknown {
  return typeof state === 'object' && state !== null && 'enteredFrom' in state ? state.enteredFrom : undefined
}

export default function BackArrow({ id }: { id: ScreenId }) {
  const { t } = useTranslation()
  const resolve = useLabel()
  const params = filled(useParams())
  const slot = useContext(BackParentContext)?.slot
  const registryParent = parentOf(id, useViewport())
  const registryPath = registryParent === undefined ? undefined : pathTo(registryParent.path, params)
  const declared = slot !== undefined && slot.screen === id && slot.param === params.id ? slot.override : undefined
  const override = declared === undefined ? undefined : targetOf(declared, registryPath)
  const entry = entryParentOf(id, enteredFromOf(useLocation().state))
  const entryScreen = declared === undefined && entry !== undefined ? screenOf(entry) : undefined
  const back = useBackOr(override?.path ?? entryScreen?.path ?? registryPath ?? HOME)
  const named = entryScreen ?? registryParent
  const label: Label | undefined =
    screenOf(id).backLabel === 'record' ? override?.title : named && { kind: 'key', key: named.titleKey }
  if (label === undefined) return null
  const word = resolve(label)
  return (
    <div className="flecha-atras">
      <Boton variant="back" onClick={back}>
        {t('common:backArrow', { parent: word })}
      </Boton>
    </div>
  )
}
