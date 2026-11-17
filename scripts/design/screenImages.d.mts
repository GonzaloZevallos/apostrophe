export const EFFORT: number;
export const PLAYWRIGHT_DISTRO: string;
export type NotStartedReason = 'docker-unavailable' | 'image-unavailable' | 'app-not-started';
export const NOT_STARTED: Readonly<Record<NotStartedReason, string>>;
export const UNSTABLE_NOTE: string;
export function imageFile(screen: string): string;

export type Rgba = { width: number; height: number; data: Buffer };
export function encodeWebp(png: Buffer): Promise<Buffer>;
export function decodeRgba(buf: Buffer): Promise<Rgba>;
export function samePixels(a: Rgba, b: Rgba): boolean;

export type IndexEntry = Readonly<{
  screen: string;
  built: string | null;
  notes?: ReadonlyArray<string>;
  reasons?: Readonly<{ built?: string }>;
}> &
  Readonly<Record<string, unknown>>;
export type Changed = 'same' | 'different' | 'unreadable-new';
export type Plan = {
  write: Array<{ file: string; status: 'new' | 'changed' }>;
  remove: string[];
  keep: string[];
  failures: Array<{ row: string; reason: string }>;
  appStarted: boolean;
  reason?: NotStartedReason;
};
export function planPublish(input: {
  registry: ReadonlyArray<Readonly<Record<string, unknown>>>;
  committed: ReadonlyArray<string>;
  index: ReadonlyArray<IndexEntry> | null;
  changed: ReadonlyMap<string, Changed>;
  appStarted: boolean;
  reason?: NotStartedReason;
}): Plan;
export function renderSummary(input: {
  plan: Plan;
  sizes: Readonly<Record<string, number>>;
  baseSha: string | null;
  mode: 'local' | 'pr' | 'master';
}): string;

export type Lockfile = string | { packages?: Readonly<Record<string, { version?: string } | undefined>> };
export function playwrightImage(lockfileJson: Lockfile): string;
/** The arguments after `docker run`. */
export function containerArgs(input: {
  image: string;
  repoDir: string;
  uid: number;
  gid: number;
  factsPath: string;
  outDir: string;
  only: ReadonlyArray<string>;
}): string[];
