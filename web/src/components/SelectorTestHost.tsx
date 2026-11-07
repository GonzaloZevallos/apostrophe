/**
 * The components the Selector's tests render (helpers are in `selectorTestKit.ts`): a Selector
 * that holds its own value, as a screen's field does, and a form with a real `<form onSubmit>`.
 */

import { type FormEventHandler, type ReactNode, useState } from 'react'
import Selector, { type SelectorProps } from './Selector'
import { SheetLevel } from './useSheetStack'

type WithoutValue<T> = T extends unknown ? Omit<T, 'value' | 'onChange'> : never

export type ControlledProps = WithoutValue<SelectorProps> & {
  initial?: string | null
  onPick?: (value: string | null) => void
}

export function Controlled({ initial = null, onPick, ...rest }: ControlledProps) {
  const [value, setValue] = useState<string | null>(initial)
  return (
    <Selector
      {...({ ...rest, value, onChange: (next) => { onPick?.(next); setValue(next) } } as SelectorProps)}
    />
  )
}

export function Form({
  children,
  level,
  onSubmit,
  title,
}: {
  children: ReactNode
  title: string
  level: number
  onSubmit: FormEventHandler<HTMLFormElement>
}) {
  return (
    <main>
      <h1>{title}</h1>
      <form onSubmit={onSubmit}>
        <SheetLevel.Provider value={level}>{children}</SheetLevel.Provider>
      </form>
    </main>
  )
}
