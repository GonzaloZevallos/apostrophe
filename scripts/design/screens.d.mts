export function assertScreens(screens: ReadonlyArray<Readonly<Record<string, unknown>>>, pantallas?: string): void;
export function assertSelectedAccounts(
  selected: ReadonlyArray<Readonly<Record<string, unknown>>>,
  kinds: Readonly<Record<string, 'open' | 'ended'>>,
): void;
export function assertAccountKinds(accounts: Readonly<Record<string, unknown>>, kinds: unknown): void;
export function sectionOccurrences(html: string, label: string): number;
export function assertSelectedNeeds(
  selected: ReadonlyArray<Readonly<Record<string, unknown>>>,
  all: ReadonlyArray<Readonly<Record<string, unknown>>>,
): void;
export const PHONE: readonly [number, number];
export function viewportsOf(s: Readonly<Record<string, unknown>>): {
  design: readonly [number, number];
  built: readonly [number, number];
};
export function screenImageRows(
  screens: ReadonlyArray<Readonly<Record<string, unknown>>>,
): Array<Readonly<Record<string, unknown>>>;
export function captureSelection(
  screens: ReadonlyArray<Readonly<Record<string, unknown>>>,
): Array<Readonly<Record<string, unknown>>>;
