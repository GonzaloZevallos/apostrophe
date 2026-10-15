export type Image = { width: number; height: number; data: Uint8Array };
export type AeResult = { ok: true; differing: number } | { ok: false; reason: 'size' };
export type Decoded = { ok: true; image: Image } | { ok: false; reason: 'unreadable' };
export type IndexEntry = { screen: string; built: string | null; design: string | null };
export type Comparison = { lines: string[]; failed: boolean };
export function ae(a: Image, b: Image): AeResult;
export function decode(buffer: Uint8Array): Decoded;
export function compareIndexes(
  before: ReadonlyArray<IndexEntry>,
  after: ReadonlyArray<IndexEntry>,
  only: ReadonlySet<string> | null,
  load: (path: string) => Decoded,
): Comparison;
