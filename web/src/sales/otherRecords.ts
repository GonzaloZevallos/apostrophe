/**
 * The other records New sale offers beside the sale itself: the single source of the "Other things
 * to record" row and of the bar's + description (`describeNewSale`, #789). It holds no copy and no
 * icon, and imports nothing: each reader keys its own words or tile by `OtherRecord`.
 */

export type OtherRecord = 'expense'

export const OTHER_RECORDS = ['expense'] as const satisfies readonly [OtherRecord, ...OtherRecord[]]
