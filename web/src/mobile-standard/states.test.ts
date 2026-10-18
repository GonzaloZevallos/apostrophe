import { describe, expect, it } from 'vitest'
import { STATES } from './allStates.ts'
import { HOME } from '../routes.ts'
import { STATE_NAMES } from './registry.ts'
import { stateNameProblems, type WalkState } from './states.ts'

describe('the walked states and their names', () => {
  it('names every walked state once, and walks every name', () => {
    expect(stateNameProblems(STATES, STATE_NAMES)).toEqual([])
  })

  it('reports a state missing from the names, a name never walked and a repeat', () => {
    const state: WalkState = { screen: 'Uno', route: HOME, steps: [], visible: 'x' }
    expect(stateNameProblems([state, state], ['Dos'])).toEqual([
      'Uno is walked but not in STATE_NAMES',
      'Uno is walked but not in STATE_NAMES',
      'Dos is in STATE_NAMES but never walked',
      'Uno is walked twice',
    ])
  })

  it('gives every state a route starting at a slash and a visible text', () => {
    for (const state of STATES) {
      expect(state.route.startsWith(HOME), state.screen).toBe(true)
      expect(state.visible, state.screen).not.toBe('')
    }
  })
})
