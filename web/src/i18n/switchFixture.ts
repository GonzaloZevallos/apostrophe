import { act } from '@testing-library/react'
import { addFixtureNamespace, removeFixtureNamespace } from './testing'
import { applyShownLanguage, setLocaleLoader } from './language'
import { clearMissingKeys } from './missingKeys'
import { englishBundle, loadLocale } from './resources'

/**
 * Test helper for a language-switch test: a fixture `de` bundle whose every value is the marker
 * `de:<ns>.<path>` of its own entry, installed with `addFixtureNamespace` and a loader that has
 * nothing left to load, then `applyShownLanguage('de')` inside `act`. A test renders first,
 * keeps a node by ref, switches, and asserts the marker is in that same node.
 */

function markers(value: unknown, path: string): unknown {
  if (typeof value !== 'object' || value === null) return `de:${path}`
  return Object.fromEntries(
    Object.entries(value).map(([name, child]) => [name, markers(child, `${path}.${name}`)]),
  )
}

const fixtureNamespaces = Object.keys(englishBundle())

export async function switchToMarkers(): Promise<void> {
  for (const [ns, content] of Object.entries(englishBundle())) {
    addFixtureNamespace(ns, markers(content, ns) as Record<string, unknown>, 'de')
  }
  setLocaleLoader(() => Promise.resolve({}))
  clearMissingKeys()
  await act(async () => {
    await applyShownLanguage('de')
  })
}

/** What `afterEach` runs: English again, the fixture bundles gone, the real loader back. */
export async function restoreEnglish(): Promise<void> {
  await act(async () => {
    await applyShownLanguage('en')
  })
  for (const ns of fixtureNamespaces) removeFixtureNamespace(ns, 'de')
  setLocaleLoader(loadLocale)
}
