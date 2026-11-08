export const SETTLE_ADVANCE_MS: number;
export const SETTLE_FRAMES: number;
export const SETTLE_BOUND: number;
export const SETTLE_QUIET_HOPS: number;
export const SETTLE_REASON_UNSETTLED: string;
export const SETTLE_REASON_REJECTED: string;
export type SettleFrame = {
  idle: boolean;
  unfinishedAnimation: boolean;
  mutated: boolean;
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
  disabled: boolean;
  checked: boolean;
  ariaChecked: string | null;
  ariaPressed: string | null;
  ariaSelected: string | null;
  ariaDisabled: string | null;
  ariaBusy: string | null;
};
export type LayoutPage = {
  scrollWidth: number;
  scrollHeight: number;
  imagesComplete: boolean;
  fontsLoaded: boolean;
};
export function signatureOf(records: ReadonlyArray<LayoutRecord>, page: LayoutPage): string;
export function frameRecords(doc: Pick<Document, 'body'>): LayoutRecord[];
export type AnimationRecord = { playState: string; pending: boolean; finite: boolean };
export function animationRecords(doc: Pick<Document, 'getAnimations'>): AnimationRecord[];
export function unfinished(records: ReadonlyArray<AnimationRecord>): boolean[];
export function shotKept(frame: SettleFrame, settledHash: string): boolean;
export type SettleKind =
  | 'unsettled'
  | 'rejected'
  | 'network'
  | 'rest-mismatch'
  | 'rest-unread'
  | 'shot-timeout'
  | 'step-timeout'
  | 'other';
export const SETTLE_KINDS: ReadonlyArray<SettleKind>;
export function isRetryableKind(kind: SettleKind | null | undefined): boolean;
export function kindOfSettle(reason: string): SettleKind;
export type SideOutcome<T> = { png: T | null; failure: string | null; kind?: SettleKind };
export function sideOutcome<T>(reason: string | null, png: T, kind?: SettleKind): SideOutcome<T>;
export const CAPTURE_ATTEMPTS: number;
export type CaptureAttempt<T> = { outcome: SideOutcome<T>; wrote: boolean };
export type CaptureResult<T> = { outcome: SideOutcome<T>; attempts: number; kinds: SettleKind[] };
export function captureWithRetries<T>(
  port: () => Promise<CaptureAttempt<T>>,
  options: { attempts: number; retryable: (kind: SettleKind | undefined) => boolean },
): Promise<CaptureResult<T>>;
export function retryNote<T>(side: string, result: CaptureResult<T>, max: number): string;
export function retrySummary(rows: number, attempts: number): string;
