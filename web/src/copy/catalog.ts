/**
 * The fixed words of the catalog screen that are always on screen, shared with its test
 * (no JSX). Listed in `LIMITED_COPY` so `copy/copyLimits.test.ts` measures the very
 * bindings `Catalogo` renders.
 */

import type { LimitedCopy } from './limits'
import { EMPTY_STATES } from './emptyStates'

export const EMPTY_STATE_TITLE = EMPTY_STATES.catalogTitle
export const EMPTY_STATE_DETAIL = EMPTY_STATES.catalogDetail

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyTitle', text: EMPTY_STATE_TITLE },
  { kind: 'emptyLine', text: EMPTY_STATE_DETAIL },
]
export const LONG_REFUSALS: readonly string[] = []
