/// <reference lib="dom" />
/**
 * The in-page toast recorder (ADR-0040, "success toasts are observed in the page").
 *
 * Success toasts expire on browser timers, so a spec that polls from outside the page can
 * miss one between two polls. This function runs inside the page: Playwright serialises its
 * source through `context.addInitScript(installToastRecorder)`, so it is a typed function
 * with no imports and no closed-over values, never a string of code.
 *
 * It watches only `.aviso-exito[role=status]` and `.toast[role=status]`, in the top frame.
 * It reads the mutation records (added nodes, `characterData` targets, `closest()`), never
 * the live document after a batch, so a toast added and removed within one batch is still
 * recorded. Its state is one `window` property; nothing goes to browser storage.
 */

export interface RecordedToast {
  seq: number
  text: string
}

export interface ToastRecorderState {
  documentId: string
  seq: number
  entries: RecordedToast[]
}

declare global {
  interface Window {
    __toastRecorder?: ToastRecorderState
  }
}

export function installToastRecorder(): void {
  if (window !== window.top) return
  const selector = '.aviso-exito[role=status], .toast[role=status]'
  const documentId = Array.from({ length: 4 }, () => Math.random().toString(36).slice(2)).join('-')
  const state: ToastRecorderState = { documentId, seq: 0, entries: [] }
  window.__toastRecorder = state
  const lastText = new WeakMap<Element, string>()

  const record = (element: Element): void => {
    const text = element.textContent ?? ''
    if (lastText.get(element) === text) return
    lastText.set(element, text)
    state.seq += 1
    state.entries.push({ seq: state.seq, text })
  }

  const recordWithin = (node: Node): void => {
    if (!(node instanceof Element)) return
    if (node.matches(selector)) record(node)
    node.querySelectorAll(selector).forEach(record)
  }

  const recordAround = (node: Node): void => {
    const element = node instanceof Element ? node : node.parentElement
    const toast = element?.closest(selector)
    if (toast) record(toast)
  }

  new MutationObserver((records) => {
    for (const mutation of records) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(recordWithin)
        recordAround(mutation.target)
      } else {
        recordAround(mutation.target)
      }
    }
  }).observe(document, { childList: true, characterData: true, subtree: true })
}
