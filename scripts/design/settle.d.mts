export const SETTLE_ADVANCE_MS: number;
export const SETTLE_FRAMES: number;
export const SETTLE_BOUND: number;
export const SETTLE_REASON_UNSETTLED: string;
export const SETTLE_REASON_REJECTED: string;
export type SettleFrame = {
  idle: boolean;
  pendingFiniteAnimation: boolean;
  fontsLoaded: boolean;
  hash: string;
};
export type SettlePort = {
  advance(ms: number): Promise<void>;
  frame(): Promise<SettleFrame>;
};
export type SettleOptions = { advanceMs: number; frames: number; bound: number };
export function settleWith(port: SettlePort, options: SettleOptions): Promise<string | null>;
export type LayoutRecord = {
  tag: string;
  left: number;
  top: number;
  width: number;
  height: number;
  text: string;
};
export type LayoutPage = {
  scrollWidth: number;
  scrollHeight: number;
  imagesComplete: boolean;
  fontsLoaded: boolean;
};
export function signatureOf(records: ReadonlyArray<LayoutRecord>, page: LayoutPage): string;
export type SideOutcome<T> = { png: T | null; failure: string | null };
export function sideOutcome<T>(reason: string | null, png: T): SideOutcome<T>;
