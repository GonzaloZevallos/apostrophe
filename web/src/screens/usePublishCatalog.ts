/**
 * Publish of the Telegram catalog (`POST /pinned-catalog/publish`), the one place that sends
 * it: the failure mapping, the "Catalog published" toast and the refresh of everything under
 * the `pinnedCatalog` prefix live here, so a screen only renders what this returns.
 *
 * A refusal with a known code reads that code's text, any other refusal and any other error
 * read the generic one, and a lost connection is `offline`. The pin's status follows the last
 * attempt, so the prefix is invalidated whether the publish worked or not.
 */

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ApiError, NetworkError, post } from '../api/client'
import { invalidateResource } from '../api/keys'
import type { PinnedCatalog } from '../api/pinnedCatalog'
import { PINNED_CATALOG_REFUSAL_OVERRIDES, resolveOverride } from '../api/refusals'
import type { SuccessToast } from '../components/AvisoExito'
import { PINNED_CATALOG_TEXT } from '../copy/pinnedCatalog'
import { GENERIC_REFUSAL_MESSAGE } from '../copy/settings'
import { refusalText } from '../i18n/refusalKeys'

export type PublishResult = 'published' | 'refused' | 'offline' | 'failed'

export type PublishOutcome =
  | { kind: 'idle' }
  | { kind: 'refused'; text: string }
  | { kind: 'offline' }
  | { kind: 'failed'; text: string }

export interface PublishCatalog {
  publish: () => Promise<PublishResult>
  publishing: boolean
  outcome: PublishOutcome
  toast: SuccessToast | null
}

const PUBLISHED_TOAST: SuccessToast = PINNED_CATALOG_TEXT.catalogPublished

export function usePublishCatalog(): PublishCatalog {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [toast, setToast] = useState<SuccessToast | null>(null)
  const [outcome, setOutcome] = useState<PublishOutcome>({ kind: 'idle' })
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    if (toast === null) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  async function publish(): Promise<PublishResult> {
    setOutcome({ kind: 'idle' })
    setPublishing(true)
    try {
      await post<PinnedCatalog>('/pinned-catalog/publish')
      setToast(PUBLISHED_TOAST)
      return 'published'
    } catch (caught) {
      if (caught instanceof ApiError) {
        const refusal = resolveOverride(PINNED_CATALOG_REFUSAL_OVERRIDES, caught.code)
        setOutcome({
          kind: 'refused',
          text: refusal === undefined ? GENERIC_REFUSAL_MESSAGE : refusalText(t, refusal),
        })
        return 'refused'
      }
      if (caught instanceof NetworkError) {
        setOutcome({ kind: 'offline' })
        return 'offline'
      }
      setOutcome({ kind: 'failed', text: GENERIC_REFUSAL_MESSAGE })
      return 'failed'
    } finally {
      setPublishing(false)
      // A failed publish records its failure server-side too, so the status follows the
      // last attempt: refetch on every path.
      invalidateResource(queryClient, 'pinnedCatalog')
    }
  }

  return { publish, publishing, outcome, toast }
}
