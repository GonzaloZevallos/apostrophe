import type { Changed, IndexEntry, NotStartedReason, Plan, Rgba } from './screenImages.mjs';

export function readCommitted(dir: string): Promise<string[]>;
export function classify(input: {
  index: ReadonlyArray<IndexEntry>;
  builtDir: string;
  committedDir: string;
  decode?: (buf: Buffer) => Promise<Rgba>;
}): Promise<Map<string, Changed>>;

/** The filesystem calls `applyPlan` makes. */
export type ApplyFs = {
  mkdir(path: string, options: { recursive: true }): Promise<unknown>;
  readFile(path: string): Promise<Buffer>;
  writeFile(path: string, data: Buffer): Promise<unknown>;
  rename(from: string, to: string): Promise<unknown>;
  unlink(path: string): Promise<unknown>;
};
export const realFs: ApplyFs;
export function applyPlan(input: { plan: Plan; outDir: string; targetDir: string; fs?: ApplyFs }): Promise<void>;
export function writeNotStarted(input: {
  outDir: string;
  reason: NotStartedReason;
  registry?: ReadonlyArray<Readonly<Record<string, unknown>>>;
}): Promise<Plan>;
export function exitCode(input: { plan: Pick<Plan, 'appStarted' | 'failures'> }): 0 | 1;
export function main(argv: ReadonlyArray<string>): Promise<number>;
