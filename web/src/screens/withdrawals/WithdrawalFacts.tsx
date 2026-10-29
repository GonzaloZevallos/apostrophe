/**
 * What a withdrawal's card shows of it: the heading, the reason by word, the date, every line and
 * the note. The detail screen and the picture of it behind the edit sheet (`WithdrawalDetailBehind`)
 * draw it from here, so the two cannot drift. It holds no id and no `h1`.
 */

import type { Withdrawal } from '../../api/stock'
import { COMMON_TEXT } from '../../copy/common'
import { STOCK_TEXT } from '../../copy/stock'
import { formatDate } from '../../format/dates'
import { formatGrams } from '../../format/money'
import { REASON_OPTIONS } from './withdrawalReasons'

export default function WithdrawalFacts({ withdrawal, today }: { withdrawal: Withdrawal; today: string }) {
  const reasonWord = REASON_OPTIONS.find((option) => option.value === withdrawal.reason)?.label ?? ''
  return (
    <>
      <div className="encabezado-fila">
        <span className="encabezado__titulo">{COMMON_TEXT.withdrawal}</span>
      </div>
      <dl className="retiro__datos">
        <div className="retiro__dato">
          <dt className="campo__rotulo">{STOCK_TEXT.motivo}</dt>
          <dd>{reasonWord}</dd>
        </div>
        <div className="retiro__dato">
          <dt className="campo__rotulo">{COMMON_TEXT.date}</dt>
          <dd>{formatDate(withdrawal.date, today)}</dd>
        </div>
      </dl>
      <ul className="retiro__lineas" aria-label={COMMON_TEXT.varieties}>
        {withdrawal.lines.map((line, index) => (
          // A variety may repeat in several lines with no merging: the position is the identity.
          <li key={index} className="retiro__linea">
            <span>{line.variety_name}</span>
            <span>{formatGrams(line.grams)}</span>
          </li>
        ))}
      </ul>
      {withdrawal.note !== null && (
        <div className="retiro__dato">
          <span className="campo__rotulo">{COMMON_TEXT.note}</span>
          <span>{withdrawal.note}</span>
        </div>
      )}
    </>
  )
}
