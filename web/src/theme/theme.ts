/**
 * The one owner of the `theme-color` meta (plan, subtask `shell-document`). The meta is
 * always the computed `--papel` of the theme in force, never a copied color, so the two
 * cannot drift apart. It follows every change of `data-tema`, a live flip of the phone on
 * Automatic included. Who writes the attribute is `theme.ts` alone: no attribute is light,
 * `oscuro` is dark, and on Automatic the system picks. Nothing here reads
 * `prefers-color-scheme`.
 */

const ATTRIBUTE = 'data-tema'

function computedPapel(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--papel')
}

/** Writes `--papel` into the one `theme-color` meta; an empty read leaves the meta as it was. */
export function syncStatusBar(readPapel: () => string = computedPapel): void {
  const papel = readPapel().trim()
  if (papel === '') return
  const meta = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta !== null) meta.content = papel
}

/**
 * Syncs now, whenever `data-tema` changes (whoever changes it), and once more when
 * the window has loaded (in dev the stylesheet can land after the script). Returns
 * the function that stops it.
 */
export function startThemeSync(readPapel: () => string = computedPapel): () => void {
  const sync = (): void => syncStatusBar(readPapel)
  sync()
  const observer = new MutationObserver(sync)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: [ATTRIBUTE] })
  window.addEventListener('load', sync)
  return () => {
    observer.disconnect()
    window.removeEventListener('load', sync)
  }
}
