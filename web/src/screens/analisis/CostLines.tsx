/**
 * The cost lines Analysis draws through `AmountRow`: the computer's tables (under each
 * week and month row), the hero and the aside. Pure rendering of what `GET /analysis`
 * answers; the phone cards do not use these (they build their rows from `rowCostParts`).
 */

import type { ReasonCost, RowCost } from '../../api/analysis'
import { COST_OF_GOODS_LABEL, SHORTFALL_LABEL } from '../../copy/analysis'
import { useMoney } from '../../format/moneyContext'
import { reasonCostParts, rowCostParts } from '../analisisCost'
import AmountRow from './AmountRow'

/** Stock shortfall, then one line per withdrawal reason in the order the API answers,
 * each apart and each with only its own "and N g without cost" (or only its grams when all
 * of it is pending). A shortfall of `null` shows nothing. */
export function WithdrawalLines({
  shortfall,
  withdrawals,
  variant,
}: {
  shortfall: RowCost | null
  withdrawals: ReasonCost[]
  variant: 'compact' | 'row'
}) {
  const money = useMoney()
  return (
    <>
      {shortfall !== null && (
        <AmountRow variant={variant} label={SHORTFALL_LABEL} value={rowCostParts(shortfall, money)} />
      )}
      {withdrawals.map((line) => (
        <AmountRow
          key={line.reason_id}
          variant={variant}
          label={line.name}
          value={reasonCostParts(line, money)}
        />
      ))}
    </>
  )
}

export type CostPeriod = {
  cost_of_goods: RowCost
  shortfall: RowCost | null
  withdrawals: ReasonCost[]
}

/** What a week or month row's sales cost and lost, in the PRD order: Costo de lo
 * vendido always, then the shortfall when present and one line per withdrawal reason. */
export function RowCostLines({ period }: { period: CostPeriod }) {
  const money = useMoney()
  return (
    <>
      <AmountRow
        variant="compact"
        label={COST_OF_GOODS_LABEL}
        value={rowCostParts(period.cost_of_goods, money)}
      />
      <WithdrawalLines
        variant="compact"
        shortfall={period.shortfall}
        withdrawals={period.withdrawals}
      />
    </>
  )
}
