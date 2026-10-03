/**
 * The only module allowed to name `navigator.clipboard` or `execCommand` (plan,
 * "Clipboard over plain http"; `forbiddenApis` enforces it). The app is served over
 * plain http on the home network (ADR-0002), where a phone browser treats the page
 * as an insecure context and withholds the async Clipboard API; copying there still
 * has to work (PRD, criterion 3), so this falls back to the old synchronous
 * `execCommand('copy')` path, the one still allowed from a user gesture regardless
 * of the page's security. That fallback runs before any `await`, so the browser
 * still credits it to the click that triggered `copyText` — an `await` first would
 * let the gesture expire and the permission get refused for no visible reason.
 * No retry in either path: a caller that wants one decides that itself.
 */

export async function copyText(text: string): Promise<boolean> {
  if (!window.isSecureContext || typeof navigator.clipboard?.writeText !== 'function') {
    return copyWithExecCommand(text)
  }
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function copyWithExecCommand(text: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  textarea.setSelectionRange(0, text.length)
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(textarea)
  }
}
