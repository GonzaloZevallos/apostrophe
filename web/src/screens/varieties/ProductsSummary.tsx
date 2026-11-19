/** The summary line of the list, counted by `summaryLine`; nothing while there is none. */

export default function ProductsSummary({ summary }: { summary: string | null }) {
  return summary === null ? null : <p className="pie variedades__resumen">{summary}</p>
}
