/** Every walked state, one spread per area; the `states-*` subtasks append theirs here. */

import { RECORDS_STATES } from './statesRecords.ts'
import type { WalkState } from './states.ts'

export const STATES: readonly WalkState[] = [...RECORDS_STATES]
