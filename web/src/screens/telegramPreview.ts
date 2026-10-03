/**
 * `telegramPreview` (plan, "Front"): the one place "Cómo se ve en Telegram" is built
 * from the API's own `text`. Pairs `**` left to right — the same rule #10's bot must
 * use when it turns markers into bold (round-2 answers, Q1) — and a final unpaired
 * `**` shows literally rather than opening a bold span that never closes. No
 * component splits on `**` itself (plan, invariants): this is the one function that
 * does, and `Catalogo.tsx` only maps its segments to spans.
 */

export interface PreviewSegment {
  text: string
  bold: boolean
}

export function telegramPreview(text: string): PreviewSegment[] {
  const parts = text.split('**')
  const segments: PreviewSegment[] = []
  let plain = parts[0] ?? ''
  let i = 1
  while (i < parts.length) {
    const bold = parts[i] ?? ''
    if (i + 1 < parts.length) {
      segments.push({ text: plain, bold: false })
      segments.push({ text: bold, bold: true })
      plain = parts[i + 1] ?? ''
      i += 2
    } else {
      // The marker at `i` has no closing partner left: it shows as typed.
      plain += '**' + bold
      i += 1
    }
  }
  segments.push({ text: plain, bold: false })
  return segments.filter((segment) => segment.text !== '')
}
