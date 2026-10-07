import { expect, test } from 'vitest'
import { CUSTOMERS } from '../routes'
import { inAppState, findInAppLiterals } from './inAppState'

test('inAppState marks the entry as in-app and carries the pathname it was opened from', () => {
  expect(inAppState({ pathname: CUSTOMERS })).toEqual({ inApp: true, from: CUSTOMERS })
})

test('inAppState keeps the extra state it is given and never lets it override the marker', () => {
  expect(inAppState({ pathname: CUSTOMERS }, { customerId: '7' })).toEqual({
    customerId: '7',
    inApp: true,
    from: CUSTOMERS,
  })
  expect(inAppState({ pathname: '/a' }, { inApp: false, from: '/b' })).toEqual({ inApp: true, from: '/a' })
})

test('findInAppLiterals flags a source that writes the marker by hand, and passes the helper and prose', () => {
  expect(
    findInAppLiterals([
      { path: 'src/screens/A.tsx', content: '<Link state={{ inApp: true }} />' },
      { path: 'src/screens/B.tsx', content: 'navigate(x, { state: {inApp:true, from: y} })' },
      { path: 'src/screens/C.tsx', content: 'const ok = state.inApp === true; inAppState(location)' },
      { path: 'src/components/inAppState.ts', content: 'return { ...extra, inApp: true, from }' },
      { path: 'src/components/inAppState.test.ts', content: "inApp: true" },
    ]),
  ).toEqual(['src/screens/A.tsx', 'src/screens/B.tsx'])
})

test.each([
  ["a single-quoted key", "state={{ 'inApp': true }}"],
  ["a double-quoted key", 'state={{ "inApp": true }}'],
  ["a computed key", 'state={{ ["inApp"]: true, from }}'],
  ["a computed key in single quotes", "state={{ ['inApp'] : true }}"],
  ["a backtick key", 'state={{ `inApp`: true }}'],
])('findInAppLiterals flags %s', (_name, content) => {
  expect(findInAppLiterals([{ path: 'src/screens/D.tsx', content }])).toEqual(['src/screens/D.tsx'])
})

test('findInAppLiterals leaves alone reading the marker and a different key', () => {
  expect(
    findInAppLiterals([
      { path: 'src/screens/E.tsx', content: "if (state['inApp'] === true) {} const inAppNow = { inAppish: true }" },
    ]),
  ).toEqual([])
})

test('no file of web/src writes the in-app marker by hand: inAppState is its only producer', () => {
  const modules = import.meta.glob<string>('/src/**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  })
  const files = Object.entries(modules).map(([path, content]) => ({ path: path.replace(/^\//, ''), content }))
  expect(files.length).toBeGreaterThan(50)
  expect(findInAppLiterals(files)).toEqual([])
})
