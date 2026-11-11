/**
 * Only `web/src/phone/device.ts` asks the browser where the app is used (docs/adr/0085):
 * no other file of `web/src` reads `navigator.languages`, `navigator.language` or the time
 * zone. Tests and `test-setup.ts` are out; comments are not code.
 */
import { describe, expect, it } from 'vitest'

const files = import.meta.glob(['../**/*.ts', '../**/*.tsx', '!../**/*.test.ts', '!../**/*.test.tsx', '!../test-setup.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const DEVICE = './device.ts'
const READ = /navigator\s*\.\s*languages?\b|resolvedOptions\s*\(\s*\)\s*\.\s*timeZone/

function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join('\n')
}

export function readers(all: Record<string, string>): string[] {
  return Object.entries(all)
    .filter(([path, source]) => path !== DEVICE && READ.test(code(source)))
    .map(([path]) => path)
}

describe('who reads the device language and time zone', () => {
  it('is device.ts alone', () => {
    expect(readers(files)).toEqual([])
    expect(READ.test(code(files[DEVICE] ?? ''))).toBe(true)
  })

  it('refuses a file that reads them', () => {
    const offender = { '../x.ts': 'const l = navigator.languages', '../y.ts': 'const z = Intl.DateTimeFormat().resolvedOptions().timeZone' }

    expect(readers(offender)).toEqual(['../x.ts', '../y.ts'])
  })

  it('lets a comment mention them', () => {
    expect(readers({ '../i18n/language.ts': ' * Never `localStorage`, `navigator.language`, a URL' })).toEqual([])
  })
})
