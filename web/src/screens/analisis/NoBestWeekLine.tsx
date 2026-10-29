import type { AnalysisWeek } from '../../api/analysis'
import { NO_BEST_WEEK_LINE } from '../../copy/analysis'

/** The "no best week" sentence, shown at both widths: only when there are weeks and none
 * of them is best (the backend decides `best`; this only reads it). */
export default function NoBestWeekLine({ weeks }: { weeks: readonly Pick<AnalysisWeek, 'best'>[] }) {
  if (weeks.length === 0 || !weeks.every((week) => !week.best)) return null
  return <span className="pie">{NO_BEST_WEEK_LINE}</span>
}
