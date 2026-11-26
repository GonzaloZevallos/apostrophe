/**
 * One row that shows a day and lets the person change it: the label, then "Today" when the day is today
 * or its dd/mm. A transparent native date input covers the whole row, so a tap anywhere opens the
 * device's own picker; the label stays its accessible name. The row never reports an empty, malformed or
 * future date: `onChange` is called only with a real ISO day on or before `today`, and anything else is
 * ignored, so the row keeps the day it shows.
 */

import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDateShort, isIsoDate } from '../format/dates'

interface Props {
  /** The day shown, as an ISO date. */
  value: string
  /** The business's today, as an ISO date: the latest day the row accepts. */
  today: string
  onChange: (iso: string) => void
  label: string
}

export default function DateRow({ value, today, onChange, label }: Props) {
  const { t } = useTranslation()
  const id = useId()
  return (
    <div className="date-row">
      <label className="date-row__label" htmlFor={id}>
        {label}
      </label>
      <span className="date-row__value">{value === today ? t('common:today') : formatDateShort(value)}</span>
      <input
        id={id}
        className="date-row__input"
        type="date"
        max={today}
        autoComplete="off"
        value={value}
        onChange={(event) => {
          const next = event.target.value
          if (isIsoDate(next) && next <= today) onChange(next)
        }}
      />
    </div>
  )
}
