/** A small copy module standing in for the real ones: strings, a nested object, an array,
 * and functions with a literal union, a nullable position, a free string and a count. */

import { baselineArgs, counted } from '../../../src/copy/baselineArgs.ts'
import type * as Self from './sample.ts'

export const LANGUAGE = 'en' as const
export const TITLE = 'Sample title'
export const LIMITED_COPY: readonly string[] = []
export const LONG_REFUSALS: readonly string[] = []

export const GROUP = {
  hello: 'Hello',
  nested: { bye: 'Bye' },
  greet: (name: string) => `Hello ${name}`,
}

export const LIST = ['first', 'second']

export function statusOf(status: 'open' | 'closed', note: string | null): string {
  return `${status}${note === null ? '' : `: ${note}`}`
}

export function salesCount(n: number): string {
  return n === 1 ? `${n} sale` : `${n} sales`
}

export const BASELINE_ARGS = baselineArgs<typeof Self>()({
  'GROUP.greet': [['Ana']],
  statusOf: [
    ['open', null],
    ['closed', 'late'],
  ],
  salesCount: counted((n) => [n]),
})
