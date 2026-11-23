/**
 * `OwedSummary`: the card on top of Customers' "Owed to you" (`customers.md`, "Owed summary"): the
 * Total owed, an age bar and a three-line legend, all from the one `Debtors` answer handed in by
 * `Clientes` or `CustomersBehind`. It runs no query and reads no amount in TypeScript: nothing here
 * adds, compares, rounds or converts a total or a bucket. Each bar part only hands its API amount
 * to CSS as `--amount`, and CSS draws its width (a $0 part takes no room, a total under 1 still
 * fills the bar). The legend keeps its three lines in the fixed order, a $0 bucket included.
 *
 * Which layout the legend and the total row take is CSS's alone, from content and `ch`: the only
 * number handed over is `--figure-ch`, how wide a nine-digit amount can be in the business's Money
 * format (`figureChOf`), never read from an amount. `OwedSummarySkeleton` is the same markup and
 * classes with a block for every text: no text, digit or symbol, hidden from assistive technology.
 */

import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { Debtors } from '../../api/payments'
import { useMoney } from '../../format/moneyContext'
import { figureChOf } from './figureCh'

declare module 'react' {
  interface CSSProperties {
    /** An API amount, as it arrives: a bar part's weight in the bar, read by CSS only. */
    '--amount'?: number
    /** The width, in `ch`, that a nine-digit amount takes in the Money format. */
    '--figure-ch'?: number
  }
}

type Bucket = 'this_week' | 'days_8_30' | 'over_30'

const BUCKETS: readonly Bucket[] = ['this_week', 'days_8_30', 'over_30']
const BUCKET_WORD = {
  this_week: 'common:owedSummaryThisWeek',
  days_8_30: 'common:owedSummaryDays8to30',
  over_30: 'common:owedSummaryOver30',
} as const
const BUCKET_CLASS = { this_week: 'recent', days_8_30: 'middle', over_30: 'old' } as const

export default function OwedSummary({ debtors }: { debtors: Debtors }) {
  const { t } = useTranslation()
  const money = useMoney()
  const ids = useId()

  return (
    <section className="owed-summary" aria-label={t('common:owedSummaryName')} style={{ '--figure-ch': figureChOf(money.format) }}>
      <div className="owed-summary__total" role="group" aria-labelledby={`${ids}-total`}>
        <span id={`${ids}-total`} className="rotulo owed-summary__label">
          {t('common:owedSummaryTotal')}
        </span>
        <span className="cifra-m owed-summary__figure">{money.money(debtors.total_owed)}</span>
      </div>
      <div className="owed-summary__bar" aria-hidden="true">
        {BUCKETS.map((bucket) => (
          <span
            key={bucket}
            className={`owed-summary__part owed-summary__part--${BUCKET_CLASS[bucket]}`}
            style={{ '--amount': debtors.buckets[bucket] }}
          />
        ))}
      </div>
      <ul className="owed-summary__legend">
        {BUCKETS.map((bucket) => (
          <li key={bucket} aria-labelledby={`${ids}-${bucket}`}>
            <span id={`${ids}-${bucket}`} className="owed-summary__word">
              {t(BUCKET_WORD[bucket])}
            </span>
            <span className={`cifra-n owed-summary__amount owed-summary__amount--${BUCKET_CLASS[bucket]}`}>
              {money.money(debtors.buckets[bucket])}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The card while the debtors read is pending: the same classes, a block where each text goes. */
export function OwedSummarySkeleton() {
  const money = useMoney()

  return (
    <div className="owed-summary owed-summary--skeleton" aria-hidden="true" style={{ '--figure-ch': figureChOf(money.format) }}>
      <div className="owed-summary__total">
        <span className="rotulo owed-summary__label owed-summary__block" />
        <span className="cifra-m owed-summary__figure owed-summary__block" />
      </div>
      <div className="owed-summary__bar" />
      <ul className="owed-summary__legend">
        {BUCKETS.map((bucket) => (
          <li key={bucket}>
            <span className="owed-summary__word owed-summary__block" />
            <span className="cifra-n owed-summary__amount owed-summary__block" />
          </li>
        ))}
      </ul>
    </div>
  )
}
