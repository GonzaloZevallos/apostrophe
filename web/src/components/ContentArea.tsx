/**
 * `ContentArea`: the element a screen's content lives in, and the one owner of its `aria-busy`
 * (CODING_STANDARDS §10 item 7). Every `<main>` in `web/src` is rendered through it
 * (`architecture/contentArea.test.ts`), so a screen's content element is named by the one
 * selector in `mobile-standard/contentArea.ts`.
 *
 * It holds a loading count outside React state (`useLoading.ts`). `useLoading` raises it in a layout
 * effect and lowers it on cleanup; when the count crosses 0 and 1 the owner sets or removes `aria-busy` on
 * its own element, before paint and without rendering again. Nothing writes `aria-busy` in JSX.
 * The owner's own layout effect runs after its children's, so it applies the count that was
 * reached before the element was attached.
 *
 * `owner={false}` renders the same element with no attribute and no count of its own: a
 * `useLoading` below it counts on the nearest owner above, if any. The element tree is the same
 * either way, so a frame that is an owner on one viewport and not on the other keeps its state.
 */

import { type HTMLAttributes, type Ref, useCallback, useContext, useLayoutEffect, useRef, useState } from 'react'
import { CONTENT_AREA } from '../mobile-standard/contentArea'
import { createLoadingStore, LoadingOwner } from './useLoading'

export interface ContentAreaProps extends HTMLAttributes<HTMLElement> {
  as: 'main' | 'div'
  ref?: Ref<HTMLElement>
  /** False for an element that is not the content area itself (a sheet's frame on a phone). */
  owner?: boolean
}

function assign(ref: Ref<HTMLElement> | undefined, node: HTMLElement | null): void {
  if (typeof ref === 'function') ref(node)
  else if (ref) ref.current = node
}

export default function ContentArea({ as: Tag, ref, owner = true, children, ...rest }: ContentAreaProps) {
  const [store] = useState(createLoadingStore)
  const parent = useContext(LoadingOwner)
  const element = useRef<HTMLElement | null>(null)
  const setElement = useCallback(
    (node: HTMLElement | null) => {
      element.current = node
      assign(ref, node)
    },
    [ref],
  )
  useLayoutEffect(() => {
    const node = element.current
    if (!owner || node === null) return
    return store.attach(node)
  }, [owner, store])
  const attributes = owner ? { [CONTENT_AREA.attribute]: '' } : {}
  return (
    <LoadingOwner.Provider value={owner ? store : parent}>
      <Tag {...rest} {...attributes} ref={setElement}>
        {children}
      </Tag>
    </LoadingOwner.Provider>
  )
}
