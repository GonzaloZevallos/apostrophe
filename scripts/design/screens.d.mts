export function assertScreens(screens: ReadonlyArray<Readonly<Record<string, unknown>>>, pantallas?: string): void;
export function assertSelectedAccounts(
  selected: ReadonlyArray<Readonly<Record<string, unknown>>>,
  kinds: Readonly<Record<string, 'open' | 'ended' | 'pre_onboarding' | 'imported' | 'onboarding'>>,
): void;
export function assertAccountKinds(accounts: Readonly<Record<string, unknown>>, kinds: unknown): void;
export function sectionOccurrences(html: string, label: string): number;
export function assertSelectedNeeds(
  selected: ReadonlyArray<Readonly<Record<string, unknown>>>,
  all: ReadonlyArray<Readonly<Record<string, unknown>>>,
): void;
