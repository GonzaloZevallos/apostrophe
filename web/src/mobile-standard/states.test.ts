import { describe, expect, it } from 'vitest'
import { STATES } from './allStates.ts'
import { MissingKeyError } from '../i18n/resolve.ts'
import { GONE_NOTICE } from '../api/refusals.ts'
import { HOME } from '../routes.ts'
import { STATE_NAMES } from './registry.ts'
import { common, refusal } from './copy.ts'
import { PENDING_TAPS } from './pending.ts'
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

describe('the walk reads the shared words from the English bundle', () => {
  const state = (screen: string): WalkState => {
    const found = STATES.find((candidate) => candidate.screen === screen)
    if (found === undefined) throw new Error(`${screen} is not walked`)
    return found
  }

  it('waits on the retry and the gone notice as the screens say them', () => {
    expect(state('EstadosReintento').visible).toBe('Something went wrong. Try again.')
    expect(state('EstadosGoneAviso').visible).toBe(refusal(GONE_NOTICE))
    expect(state('EstadosGoneAviso').steps).toContainEqual({ click: 'Yes, delete it' })
  })

  it('taps the payment form by the words the form shows', () => {
    const payment = PENDING_TAPS.find((tap) => tap.screen === 'CobroDesdeClientes')
    expect(payment?.steps).toEqual([
      { click: 'Nico Parra' },
      { click: 'Record payment' },
      { fill: { label: 'Amount', value: '1000' } },
      { click: 'Cash' },
    ])
    expect(payment?.button).toBe('Save')
  })

  it('refuses a key the English bundle does not have', () => {
    expect(() => common('common:noSuchWord' as Parameters<typeof common>[0])).toThrow(MissingKeyError)
  })
})
