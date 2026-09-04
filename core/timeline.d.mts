export type Cue = {
  index: number;
  id: string;
  start: number;
  end: number;
  text: string;
  settings: string;
};
export type Cut = { start: number; end: number };
export type ChangeStatus =
  | 'removed'
  | 'split'
  | 'trimmed'
  | 'shifted'
  | 'unchanged';
export type SubtitleDocument = {
  format: 'srt' | 'vtt';
  header: string;
  metadata: string[];
  cues: Cue[];
};
export type Change = { original: Cue; parts: Cue[]; status: ChangeStatus };
export type Report = SubtitleDocument & {
  changes: Change[];
  cuts: Cut[];
  removedMs: number;
  counts: Record<ChangeStatus, number>;
};
export function parseTime(value: string): number;
export function formatTime(ms: number, separator?: string): string;
export function parseSubtitles(text: string): SubtitleDocument;
export function parseCuts(text: string): Cut[];
export function applyCuts(document: SubtitleDocument, cuts: Cut[]): Report;
export function serializeSubtitles(document: SubtitleDocument): string;
export function retime(subtitleText: string, cutText: string): Report;
