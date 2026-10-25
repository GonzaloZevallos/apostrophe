/**
 * The fixture arguments of a copy module's functions, for `web/scripts/i18n/baseline.ts`
 * (the English baseline, `copy/en.baseline.json`). Each copy file exports a
 * `BASELINE_ARGS` table, keyed by export path (`'STOCK_TEXT.onHandHelp'`), whose value is
 * the list of argument tuples the function is called with.
 *
 * It is not `limits.SAMPLES`, which holds the worst-case fills the length checker
 * measures; a baseline row may use any value that shows the function's branches.
 *
 * The list must be exhaustive over what the type can list:
 * - one tuple per member of a literal-union parameter (`'a' | 'b'` needs a tuple with
 *   `'a'` and a tuple with `'b'` in that position);
 * - one tuple with `null` (or `undefined`) wherever a parameter admits it;
 * - a free `string` or `number` takes any fixture.
 * A missing member is a type error naming the path and the position (`Check`).
 *
 * Known gap: a branch on the *value* of a free `string` or `number` is covered only where
 * the fixture falls. The type cannot list those values, so review does.
 *
 * Anything that takes a count is wrapped in `counted(n => [...])`, which expands to the
 * calls for 0, 1 and 2; the plural-sensitivity test keeps that set honest.
 */

/** Names a copy module exports that are not texts: the baseline never walks them. */
export type NotCopy = 'LIMITED_COPY' | 'LONG_REFUSALS' | 'BASELINE_ARGS'

type Fn = (...args: never[]) => unknown

/** The dotted paths of the functions a module (or object) holds. Arrays are not walked. */
export type FnPaths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends Fn
    ? `${Prefix}${K}`
    : T[K] extends readonly unknown[]
      ? never
      : T[K] extends object
        ? FnPaths<T[K], `${Prefix}${K}.`>
        : never
}[keyof T & string]

/** The function at a dotted path. */
export type FnAt<T, Path extends string> = Path extends `${infer Head}.${infer Rest}`
  ? Head extends keyof T
    ? FnAt<T[Head], Rest>
    : never
  : Path extends keyof T
    ? T[Path]
    : never

type ParamsOf<F> = F extends (...args: infer P) => unknown ? P : never

type ArgRows<F> = readonly (readonly [...ParamsOf<F>])[]

/** The shape of a `BASELINE_ARGS` table: one list of argument tuples per function. */
export type BaselineArgs<M> = {
  readonly [Path in FnPaths<Omit<M, NotCopy>>]: ArgRows<FnAt<M, Path>>
}

/** What a position must show at least once: the members of a literal union, `null` and
 * `undefined`. A free `string`, `number` or an object demands nothing. */
type Demand<T> = T extends null | undefined
  ? T
  : T extends string
    ? string extends T
      ? never
      : T
    : T extends number
      ? number extends T
        ? never
        : T
      : T extends boolean
        ? T
        : never

type SeenAt<Row, K> = Row extends unknown ? (K extends keyof Row ? Row[K] : never) : never

/** For each position of a function's parameters, what its rows leave out. */
export type Uncovered<P, Rows extends readonly (readonly unknown[])[]> = {
  [K in keyof P & `${number}` as [Exclude<Demand<P[K]>, SeenAt<Rows[number], K>>] extends [never]
    ? never
    : K]: Exclude<Demand<P[K]>, SeenAt<Rows[number], K>>
}

type Gaps<M, T> = {
  [P in keyof T & FnPaths<Omit<M, NotCopy>> as [keyof Uncovered<ParamsOf<FnAt<M, P>>, Extract<T[P], readonly (readonly unknown[])[]>>] extends [never]
    ? never
    : P]: Uncovered<ParamsOf<FnAt<M, P>>, Extract<T[P], readonly (readonly unknown[])[]>>
}

type Extras<M, T> = Exclude<keyof T, FnPaths<Omit<M, NotCopy>>>

/** `unknown` (so it adds nothing to the table) when every function's rows are exhaustive
 * and no row names a path that is not a function; otherwise the object that names what is
 * missing, which the table is not assignable to. */
export type Check<M, T> = [keyof Gaps<M, T>] extends [never]
  ? [Extras<M, T>] extends [never]
    ? unknown
    : { notAFunction: Extras<M, T> }
  : { missing: Gaps<M, T> }

/**
 * The `BASELINE_ARGS` of a copy module, checked against the module's own type:
 *
 * ```ts
 * import type * as Self from './stock.ts'
 * export const BASELINE_ARGS = baselineArgs<typeof Self>()({ 'onHandHelp': [['10 g']] })
 * ```
 */
export function baselineArgs<M>() {
  return <const T extends BaselineArgs<M>>(table: T & Check<M, T>): T => table
}

const COUNTED = Symbol('counted')

/** A row built by `counted`: the plural-sensitivity test finds the wrapped functions by it. */
export function isCounted(row: readonly unknown[]): boolean {
  return Object.hasOwn(row, COUNTED)
}

/** The rows for a function that takes a count: `build` is called with 0, 1 and 2. */
export function counted<const A extends readonly unknown[]>(build: (n: number) => A): readonly [A, A, A] {
  const mark = (n: number): A => Object.defineProperty([...build(n)], COUNTED, { value: true }) as unknown as A
  return [mark(0), mark(1), mark(2)]
}
