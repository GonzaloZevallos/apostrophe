/**
 * `expectToast(page, text, action)`: asserts that the toast `action` raises was shown, from
 * the in-page recorder (`../toastRecorder.ts`, ADR-0040 "success toasts are observed in the
 * page") and not from a poll of the page that can land after the toast's own timer.
 *
 * 1. It reads the mark `{documentId, seq}` of the page's recorder.
 * 2. It runs `action`.
 * 3. It polls for an entry with exactly `text`, from the same document, recorded after the
 *    mark. An entry from before the mark, or from another document, never counts: a
 *    history-state toast renders again after a reload, so a newer document must not pass.
 *
 * It fails at once, with one of the three fixed messages below, when the page has no
 * recorder or the document changed. It never waits for a load state.
 */

import type { Page } from '@playwright/test'
import { expect } from '../fixtures.js'

export const NO_RECORDER =
  'expectToast: this page has no toast recorder; its context was not made through the fixture or withToastRecorder'
export const DOCUMENT_CHANGED_AT_MARK = 'expectToast: the page was navigating when the mark was read'
export const DOCUMENT_CHANGED = 'expectToast: the document changed during the action'

interface Mark {
  documentId: string
  seq: number
}

type Poll = 'found' | 'pending' | 'changed'

const DESTROYED = /Execution context was destroyed/

async function readMark(page: Page): Promise<Mark> {
  let mark: Mark | null
  try {
    mark = await page.evaluate(() => {
      const recorder = window.__toastRecorder
      return recorder === undefined ? null : { documentId: recorder.documentId, seq: recorder.seq }
    })
  } catch (error) {
    if (error instanceof Error && DESTROYED.test(error.message)) throw new Error(DOCUMENT_CHANGED_AT_MARK)
    throw error
  }
  if (mark === null) throw new Error(NO_RECORDER)
  return mark
}

async function look(page: Page, mark: Mark, text: string): Promise<Poll> {
  try {
    return await page.evaluate(
      ({ documentId, seq, wanted }): Poll => {
        const recorder = window.__toastRecorder
        if (recorder === undefined || recorder.documentId !== documentId) return 'changed'
        return recorder.entries.some((entry) => entry.seq > seq && entry.text === wanted) ? 'found' : 'pending'
      },
      { documentId: mark.documentId, seq: mark.seq, wanted: text },
    )
  } catch (error) {
    if (error instanceof Error && DESTROYED.test(error.message)) return 'changed'
    throw error
  }
}

export async function expectToast(page: Page, text: string, action: () => Promise<unknown>): Promise<void> {
  const mark = await readMark(page)
  await action()
  const seen: { last: Poll } = { last: 'pending' }
  await expect
    .poll(
      async () => {
        seen.last = await look(page, mark, text)
        return seen.last
      },
      { message: `expectToast: no toast with the text ${JSON.stringify(text)} was recorded after the action` },
    )
    .not.toBe('pending')
  if (seen.last === 'changed') throw new Error(DOCUMENT_CHANGED)
}
