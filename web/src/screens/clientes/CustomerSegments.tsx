/**
 * The Customers All | Owed to you control with each segment's count. The only drawer of it: the
 * options are `CUSTOMER_SEGMENTS`, and the counts are the server's, formatted by `segmentCount`
 * and nothing more. `pending` is the only gate: while the counts are pending or unavailable the
 * labels show alone (no figure, no dot), and a real 0 is shown as 0. Both options stay tappable.
 */

import SegmentedChoice from '../../components/SegmentedChoice'
import { CUSTOMER_SEGMENTS, type FixedValue } from '../../components/fixedSets'
import { CUSTOMERS_TEXT } from '../../copy/customers'
import { segmentCount, type SegmentCount } from '../../format/counts'

type CustomerSegment = FixedValue<typeof CUSTOMER_SEGMENTS>

interface CustomerSegmentsProps {
  segment: CustomerSegment
  onChange: (segment: CustomerSegment) => void
  customerCount: number
  debtorCount: number
  pending: boolean
}

export default function CustomerSegments({
  segment,
  onChange,
  customerCount,
  debtorCount,
  pending,
}: CustomerSegmentsProps) {
  let suffix: Record<CustomerSegment, SegmentCount> | undefined
  if (!pending) suffix = { all: segmentCount(customerCount), owed: segmentCount(debtorCount) }
  return (
    <div className="segmentos-clientes">
      <SegmentedChoice
        options={CUSTOMER_SEGMENTS}
        value={segment}
        onChange={onChange}
        ariaLabel={CUSTOMERS_TEXT.customersView}
        suffix={suffix}
      />
    </div>
  )
}
