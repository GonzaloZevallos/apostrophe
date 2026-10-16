export function assertScreens(screens: ReadonlyArray<Readonly<Record<string, unknown>>>): void;
export function assertSelectedAccounts(
  selected: ReadonlyArray<Readonly<Record<string, unknown>>>,
  accountNames: ReadonlyArray<string>,
): void;
export function sectionOccurrences(html: string, label: string): number;
