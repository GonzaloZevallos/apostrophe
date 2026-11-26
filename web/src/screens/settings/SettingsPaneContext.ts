/**
 * Whether a Settings group is framed by the computer's pane. `SettingsGroup` is the only reader:
 * inside the pane, a group opened from the Settings list has the list beside it, so it drops its
 * Close. The default `false` is the phone and every other entry, which keep today's Close.
 */

import { createContext } from 'react'

export const SettingsPaneContext = createContext(false)

/** Whether a history state says the screen was opened from a Settings row or shortcut. */
export function isEnteredFromSettings(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'enteredFrom' in state && state.enteredFrom === 'settings'
}
