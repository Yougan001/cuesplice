import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { parseSubtitles } from '../core/timeline.mjs';

const path = process.argv[2];
if (!path)
  throw new Error(
    'Pass the directory containing the sample browser downloads.',
  );
const subtitles = parseSubtitles(
  readFileSync(`${path}/frame-tutorial.edited.srt`, 'utf8'),
);
const report = JSON.parse(
  readFileSync(`${path}/frame-tutorial.changes.json`, 'utf8'),
);
assert.equal(subtitles.cues.length, 6);
assert.equal(subtitles.cues.at(-1).start, 22_500);
assert.equal(subtitles.cues.at(-1).end, 26_500);
assert.deepEqual(
  subtitles.cues.map(({ start, end, text }) => ({ start, end, text })),
  report.cues.map(({ start, end, text }) => ({ start, end, text })),
);
assert.equal(report.removedMs, 7500);
assert.deepEqual(report.counts, {
  removed: 1,
  split: 1,
  trimmed: 1,
  shifted: 2,
  unchanged: 1,
});
console.log(
  'Downloaded SRT and JSON agree: 6 output cues, 7.500 seconds removed.',
);
