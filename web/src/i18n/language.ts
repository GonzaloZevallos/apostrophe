/**
 * The language the front speaks, and the only module that calls `changeLanguage` (ADR-0050).
 * It is only ever given two things: the `<html lang>` the server wrote, read once at boot, and
 * the `shown_language` of `/auth/me`. Never `localStorage`, `navigator.language`, a URL or any
 * other request input.
 *
 * English is in the bundle; any other language is one lazy chunk. A load that fails or never
 * settles ends in English with one recorded miss, and a result that arrives late, or after the
 * session it was asked for ended, never changes the language. Every session boundary goes back
 * to the language of boot (`resetToBootLanguage`), so the last business's language never shows
 * on Entrar, the invitation or the reset screens.
 */

import { useEffect, useSyncExternalStore } from 'react'
import type { Me } from '../api/me'
import i18n, { installLocale } from '.'
import { missingKeyHandler } from './missingKeys'
import { loadLocale, type LocaleLoader } from './resources'

const ENGLISH = 'en'

/** How long a language chunk may take before the front gives up and stays in English. */
export const LANGUAGE_LOAD_TIMEOUT_MS = 5_000

/** The server-written `<html lang>`, read once; an unwritten one is English. */
export const bootLanguage: string = document.documentElement.lang || ENGLISH

// The language the boot actually ended in: `bootLanguage`, or English when its chunk failed.
let bootApplied = ENGLISH

let loader: LocaleLoader = loadLocale

/** Swaps the chunk loader; tests pass a fake, and `loadLocale` puts the real one back. */
export function setLocaleLoader(next: LocaleLoader): void {
  loader = next
}

// Every language a load was started for in this session, with how that load ended. A language
// in here is never loaded again until a session boundary empties it.
const attempted = new Map<string, Promise<boolean>>()
const failed = new Set<string>()

// Bumped by every request to change language and by every reset: only the latest request may apply.
let currentRequest = 0

// Bumped only by a reset: a load that started before it must not mark anything as failed for the
// session that follows.
let epoch = 0

let version = 0
const listeners = new Set<() => void>()

function notify(): void {
  version += 1
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function recordMiss(language: string): void {
  // Recorded only under the test runner, like the handler `./index.ts` installs; production
  // installs nothing and emits nothing.
  if (import.meta.env.MODE === 'test') missingKeyHandler(language, '*', '*')
}

function applyNow(language: string, tellReaders = true): void {
  if (i18n.language !== language) void i18n.changeLanguage(language)
  document.documentElement.lang = language
  if (tellReaders) notify()
}

/** One load of one chunk: true when it landed in time, false (one miss recorded) when not. */
function attempt(language: string): Promise<boolean> {
  const startedIn = epoch
  return new Promise<boolean>((resolve) => {
    let settled = false
    const finish = (ok: boolean): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (!ok) {
        if (startedIn === epoch) failed.add(language)
        recordMiss(language)
      }
      resolve(ok)
    }
    const timer = setTimeout(() => {
      finish(false)
    }, LANGUAGE_LOAD_TIMEOUT_MS)
    installLocale(language, loader).then(
      () => {
        finish(true)
      },
      () => {
        finish(false)
      },
    )
  })
}

/**
 * Makes `language` the one the front speaks, loading its chunk first when it is not in the
 * bundle. When the load fails or times out, English. Only the latest request applies.
 */
export async function applyShownLanguage(language: string): Promise<void> {
  currentRequest += 1
  const request = currentRequest
  if (language === ENGLISH || language === i18n.language) {
    applyNow(language)
    return
  }
  let outcome = attempted.get(language)
  if (outcome === undefined) {
    outcome = attempt(language)
    attempted.set(language, outcome)
  }
  const loaded = await outcome
  if (request !== currentRequest) return
  applyNow(loaded ? language : ENGLISH)
}

/** Awaited by `main.tsx` before the first render, only when the boot language is not English. */
export async function startLanguage(): Promise<void> {
  await applyShownLanguage(bootLanguage)
  bootApplied = i18n.language
}

/**
 * Every session boundary: back to the language of boot, forgetting what was attempted. It runs
 * between the cache clear and the navigation, so it tells no mounted reader: a re-render of the
 * still-mounted gated layout here would fetch `/auth/me` again from the emptied cache. The
 * navigation unmounts those readers, and a reader mounted later works its readiness out afresh.
 */
export function resetToBootLanguage(): void {
  attempted.clear()
  failed.clear()
  currentRequest += 1
  epoch += 1
  applyNow(bootApplied, false)
}

/**
 * True when the texts of `me.shown_language` can be rendered: that language is the one the
 * instance speaks, or its load failed and English stands in. Worked out during render, so an
 * English business mounts in the same commit its `me` arrives in. The effect that starts a
 * load depends on `shown_language` alone.
 */
export function useShownLanguage(me: Pick<Me, 'shown_language'> | undefined): boolean {
  useSyncExternalStore(subscribe, () => version)
  const shown: string | undefined = me?.shown_language
  useEffect(() => {
    if (shown !== undefined) void applyShownLanguage(shown)
  }, [shown])
  return shown === undefined || i18n.language === shown || failed.has(shown)
}
