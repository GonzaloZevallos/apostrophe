/**
 * The wordings a screen must never show while its data loads (no false empty state). The
 * list is the screens' own (`screens/emptyStates.ts`), imported, never copied: a new empty
 * state is added there once and is forbidden here without another edit.
 */

import { EMPTY_STATE_WORDINGS } from '../screens/emptyStates.ts'

export const FORBIDDEN_WHILE_LOADING: readonly string[] = EMPTY_STATE_WORDINGS
