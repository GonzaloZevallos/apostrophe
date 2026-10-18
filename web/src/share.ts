/**
 * The only module allowed to name `navigator.share` (plan, "Compartir";
 * `forbiddenApis` enforces it). The native share sheet needs a secure context, so over
 * the home network's plain http (ADR-0002) `canShare` is false and the screen offers
 * Copiar alone. A seller closing the sheet is an `AbortError`, which is not a failure.
 * Any other outcome is "failed". The error object is dropped on purpose: it may carry
 * the text, and nothing here logs (CODING_STANDARDS §9, §10).
 */

export type ShareOutcome = 'shared' | 'cancelled' | 'failed'

export function canShare(): boolean {
  return window.isSecureContext && typeof navigator.share === 'function'
}

export async function shareText(text: string): Promise<ShareOutcome> {
  try {
    await navigator.share({ text })
    return 'shared'
  } catch (caught) {
    return caught instanceof DOMException && caught.name === 'AbortError' ? 'cancelled' : 'failed'
  }
}
