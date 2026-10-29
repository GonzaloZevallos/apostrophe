/** A bar's fill, purely a rendering proportion against the widest value in its own
 * list — it names no business figure of its own and decides no mark, sort, share or
 * percentage: the figure next to every bar is still the backend's own number. */
function barWidth(value: number, max: number): number {
  if (max <= 0) return 0
  return Math.max(0, Math.min(100, (value / max) * 100))
}

export default function Bar({
  value,
  max,
  decorative = false,
}: {
  value: number
  max: number
  /** The card's bar repeats the figure next to it, so it is hidden from assistive technology. */
  decorative?: boolean
}) {
  return (
    <span className="analisis__barra-pista" aria-hidden={decorative ? true : undefined}>
      <span
        className="analisis__barra-llena"
        style={{ width: `${barWidth(value, max)}%` }}
      />
    </span>
  )
}
