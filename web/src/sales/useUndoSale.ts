/**
 * Announce a saved sale and take it back in one tap. The host sees only `announceSaved`: the
 * DELETE, which result shows and what is fetched again stay here.
 *
 * Each announce holds its own sale id. `undo` takes it and clears it before its first `await`,
 * so a double tap sends one DELETE and a newer announce never inherits an older id. Everything
 * `undo` uses (`qc`, `showNow`, `mutateAsync`) is read from the closure and the outcome is handled
 * after the `await`, never in per-call callbacks or render state, so the result still shows once
 * the host has unmounted and the route has changed.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ApiError, NetworkError } from '../api/client'
import { invalidateResource, keys } from '../api/keys'
import { isGone } from '../api/refusals'
import { deleteSale } from '../api/sales'
import { SALE_SAVED_TOAST_MS } from '../flash/FlashProvider'
import type { UndoResult } from '../flash/flashReducer'
import { useFlash } from '../flash/useFlash'
import { SALES_TEXT } from '../copy/sales'

/** Which result an Undo that threw shows; `null` for a 401, which the session boundary handles. */
export function undoOutcome(error: unknown): UndoResult | null {
  if (error instanceof ApiError && error.status === 401) return null
  if (error instanceof NetworkError) return 'offline'
  if (error instanceof ApiError && isGone(error.code)) return 'gone'
  return 'failed'
}

export function useUndoSale(): { announceSaved: (args: { saleId: number; name: string | null }) => void } {
  const qc = useQueryClient()
  const { armAfterLeaving, showNow } = useFlash()
  const { t } = useTranslation()
  // `useMutation`, not a bare call: a 401 reaches `MutationCache.onError` (`queryClient.ts`).
  const { mutateAsync } = useMutation({ mutationFn: deleteSale })

  function announceSaved({ saleId, name }: { saleId: number; name: string | null }): void {
    let pending: number | null = saleId

    async function undo(): Promise<void> {
      const id = pending
      if (id === null) return
      pending = null
      try {
        await mutateAsync(String(id))
      } catch (error) {
        const result = undoOutcome(error)
        if (result !== null) showNow({ kind: 'undoResult', result })
        return
      }
      invalidateResource(qc, 'sales')
      invalidateResource(qc, 'stock')
      void qc.invalidateQueries({ queryKey: keys.saleFormSuggestionsAll() })
      showNow({ kind: 'undoResult', result: 'deleted' })
    }

    armAfterLeaving(
      { kind: 'saleSaved', name: name ?? SALES_TEXT.noCustomer },
      { durationMs: SALE_SAVED_TOAST_MS, action: { label: t('common:undo'), onPress: () => void undo() } },
    )
  }

  return { announceSaved }
}
