/**
 * The cost lines Analysis draws through `AmountRow`: the computer's tables (under each
 * week and month row), the hero and the aside. Pure rendering of what `GET /analysis`
 * answers; the phone cards do not use these (they build their rows from `rowCostParts`).
 */

import type { RowCost } from '../../api/analysis'
import { COST_OF_GOODS_LABEL, OWN_USE_LABEL, PROMOTION_LABEL, SHORTFALL_LABEL } from '../../copy/analysis'
import { rowCostParts } from '../analisisCost'
import AmountRow from './AmountRow'

/** Faltante de stock, Promoción and Consumo propio (CONTEXT.md), each apart and each
 * with only its own "y N g sin costo" (or only its grams when all of it is pending).
 * `null` when the period has none of that reason's records: nothing is shown. */
export function WithdrawalLines({
  shortfall,
  promotion,
  ownUse,
  variant,
}: {
  shortfall: RowCost | null
  promotion: RowCost | null
  ownUse: RowCost | null
  variant: 'compact' | 'row'
}) {
  return (
    <>
      {shortfall !== null && (
        <AmountRow variant={variant} label={SHORTFALL_LABEL} value={rowCostParts(shortfall)} />
      )}
      {promotion !== null && (
        <AmountRow variant={variant} label={PROMOTION_LABEL} value={rowCostParts(promotion)} />
      )}
      {ownUse !== null && (
        <AmountRow variant={variant} label={OWN_USE_LABEL} value={rowCostParts(ownUse)} />
      )}
    </>
  )
}

export type CostPeriod = {
  cost_of_goods: RowCost
  shortfall: RowCost | null
  promotion: RowCost | null
  own_use: RowCost | null
}

/** What a week or month row's sales cost and lost, in the PRD order: Costo de lo
 * vendido always, then Faltante de stock, Promoción and Consumo propio when present. */
export function RowCostLines({ period }: { period: CostPeriod }) {
  return (
    <>
      <AmountRow
        variant="compact"
        label={COST_OF_GOODS_LABEL}
        value={rowCostParts(period.cost_of_goods)}
      />
      <WithdrawalLines
        variant="compact"
        shortfall={period.shortfall}
        promotion={period.promotion}
        ownUse={period.own_use}
      />
    </>
  )
}
