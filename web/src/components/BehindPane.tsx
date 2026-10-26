/**
 * `BehindPane`: the screen drawn behind a phone sheet when its form was opened by a direct
 * address (navigation.md, "Back with no history"). It is only a picture of the parent: `inert` so
 * nothing in it can be reached, `aria-hidden` so assistive technology skips it, and a body that
 * draws no chrome, no `h1` and no ids (ADR-0053). A host draws it as `{!computer && <BehindPane>…}`
 * right before its form's `Sheet`, so the form keeps one place on both viewports.
 */

import type { ReactNode } from 'react'

export default function BehindPane({ children }: { children: ReactNode }) {
  return (
    <div className="behind-pane" inert aria-hidden="true">
      {children}
    </div>
  )
}
