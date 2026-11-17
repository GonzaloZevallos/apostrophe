/**
 * The one two-way type equality of the web app: `Equal<A, B>` is `true` only when each type is
 * assignable to the other in the strictest sense (the conditional-function form, which also
 * tells `any` and `never` apart). `assertType` takes `true` for `Equal<A, B>`, so a mismatch is a
 * compile error where the assertion is written, never a runtime cost.
 */

export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

/** `assertType<Equal<A, B>>()` compiles only when the two types are the same. */
export function assertType<_Holds extends true>(): void {}
