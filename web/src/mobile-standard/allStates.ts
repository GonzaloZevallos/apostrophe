/** Every walked state, one spread per area; the `states-*` subtasks append theirs here. */

import { RECORDS_STATES } from './statesRecords.ts'
import { GETTING_IN_STATES } from './statesGettingIn.ts'
import { SALES_STATES } from './statesSales.ts'
import type { WalkState } from './states.ts'

export const STATES: readonly WalkState[] = [...SALES_STATES, ...RECORDS_STATES, ...GETTING_IN_STATES]
