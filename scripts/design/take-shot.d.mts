import type { BrowserContext, JSHandle, Locator, Page } from 'playwright';
import type { Census } from './census.mjs';
import type { SettleKind, SideOutcome } from './settle.mjs';
import type { Clip, Side, Snapshot, Viewport } from './shot.mjs';

export type ShotConfig = { timeoutMs: number; instant: Date };
export type ShotOptions = {
  block: Locator | null;
  ofFirstText: boolean;
  census?: Census | null;
  side: Side;
};
export type SettleArgs = { advanceMs: number; afterGoto?: boolean; ofFirstText: boolean };
export type TextScaled = { text_scale?: number };

export function configureShot(config: ShotConfig): void;
export function pauseClock(context: BrowserContext): Promise<void>;
export function addProbe(context: BrowserContext): Promise<void>;
export function withinTimeout<T>(promise: Promise<T>): Promise<T>;
export type Settled = { reason: string | null; kind: SettleKind | null };
export function settleKinded(page: Page, args: SettleArgs): Promise<Settled>;
export function settle(page: Page, args: SettleArgs): Promise<string | null>;
export function restAfterShot(page: Page): Promise<Settled>;
export const firstLine: (error: unknown) => string;
export function scaleMisses(page: Page, s: TextScaled, side: string, when: string): Promise<string | null>;
export const settledViewport: WeakMap<Page, Viewport | null>;
export function verifyAfterShot(
  page: Page,
  s: TextScaled,
  label: string,
  png: Buffer,
  side: Side,
): Promise<SideOutcome<Buffer>>;
export function sectionBox(block: Locator): Promise<Clip & { right: number; bottom: number }>;
export function sectionClip(block: Locator): Promise<Clip>;
export const bounded: <T>(promise: Promise<T> | T) => Promise<T>;
export function growViewport(page: Page, size: Viewport): Promise<void>;
export function sizeSnapshot(page: Page, handle: JSHandle): Promise<Snapshot>;
export function nodeIdentity(
  page: Page,
  before: Snapshot,
  beforeHandle: JSHandle,
  after: Snapshot,
  afterHandle: JSHandle,
): Promise<void>;
export function takeShot(page: Page, options: ShotOptions): Promise<SideOutcome<Buffer>>;
export function shotSteps(page: Page, options: ShotOptions, handles: JSHandle[]): Promise<SideOutcome<Buffer>>;
