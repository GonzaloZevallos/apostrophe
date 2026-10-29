/**
 * Keeps the focused field in view when the on-screen keyboard opens (GH-77, "touch and
 * keyboard"). `interactive-widget=resizes-content` makes Android resize the layout
 * viewport; iOS only resizes the visual one. Either way the field the person just
 * tapped can land under the keyboard, so after the viewport settles it is scrolled to
 * the centre once. Only fields in a sheet or in a form with no tab bar: elsewhere the
 * browser's own behaviour is left alone.
 */

const FIELDS = 'input, textarea, select'
const CONTAINERS = '.capa, .sheet, .cliente-sheet, .columna-principal--sin-bar'
/** How long to wait for the keyboard's resize before scrolling anyway. */
const KEYBOARD_WAIT_MS = 300

function isFieldToKeepVisible(target: EventTarget | null): target is HTMLElement {
  return target instanceof HTMLElement && target.matches(FIELDS) && target.closest(CONTAINERS) !== null
}

/** Registers the one `focusin` listener; the returned function removes it. */
export function startKeepFocusVisible(): () => void {
  const viewport = window.visualViewport
  if (viewport === null || viewport === undefined) return () => undefined

  const onFocusIn = (event: FocusEvent): void => {
    const target = event.target
    if (!isFieldToKeepVisible(target)) return

    let timer = 0
    const settle = (): void => {
      viewport.removeEventListener('resize', settle)
      window.clearTimeout(timer)
      target.scrollIntoView({ block: 'center' })
    }
    viewport.addEventListener('resize', settle)
    timer = window.setTimeout(settle, KEYBOARD_WAIT_MS)
  }

  document.addEventListener('focusin', onFocusIn)
  return () => document.removeEventListener('focusin', onFocusIn)
}
