/**
 * What sits behind the edit-withdrawal sheet on a phone, on a direct address (ADR-0062;
 * navigation.md's back-with-no-history table, "Withdrawal form, edit → Withdrawal detail"): the
 * withdrawal's card, from the card's own query key, so the form's own read is the only GET. It draws
 * only from resolved data: while pending and on any error it is empty, with no skeleton and no
 * wording (the form route keeps its own errors). It shares `WithdrawalFacts` with the card and
 * leaves out its Edit and Delete, which would act under a sheet. It draws no chrome, no `h1`, no ids.
 */

import { useQuery } from '@tanstack/react-query'
import { useOutletContext } from 'react-router'
import { keys } from '../../api/keys'
import type { Me } from '../../api/me'
import { getWithdrawal } from '../../api/stock'
import WithdrawalFacts from './WithdrawalFacts'

export default function WithdrawalDetailBehind({ withdrawalId }: { withdrawalId: string }) {
  const me = useOutletContext<Me>()
  const { data } = useQuery({
    queryKey: keys.stockWithdrawal(withdrawalId),
    queryFn: () => getWithdrawal(withdrawalId),
    retry: false,
  })

  if (data === undefined) return null

  return (
    <div className="pantalla">
      <div className="cuerpo">
        <WithdrawalFacts withdrawal={data} today={me.today} />
      </div>
    </div>
  )
}
