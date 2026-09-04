const MAX_TIME = 35_999_999_999;
const MAX_TEXT = 2_000_000;

export function parseTime(value) {
  const text = String(value).trim().replace(',', '.');
  if (!/^(?:(?:\d{1,4}:)?\d{1,2}:\d{2}|\d{1,8})(?:\.\d{1,3})?$/.test(text)) {
    throw new Error(
      `Invalid timestamp: ${value}. Use HH:MM:SS.mmm or seconds.`,
    );
  }
  const parts = text.split(':');
  const seconds = parts.pop().split('.');
  const minutes = Number(parts.pop() ?? 0);
  const hours = Number(parts.pop() ?? 0);
  if (minutes > 59 || (text.includes(':') && Number(seconds[0]) > 59)) {
    throw new Error(`Timestamp is out of range: ${value}.`);
  }
  const result =
    (hours * 3600 + minutes * 60 + Number(seconds[0])) * 1000 +
    Number((seconds[1] ?? '').padEnd(3, '0'));
  if (result > MAX_TIME)
    throw new Error('Timestamps must be shorter than 10,000 hours.');
  return result;
}

export function formatTime(ms, separator = '.') {
  if (!Number.isSafeInteger(ms) || ms < 0 || ms > MAX_TIME)
    throw new Error('Invalid millisecond timestamp.');
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor(ms / 60_000) % 60;
  const seconds = Math.floor(ms / 1000) % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}${separator}${String(ms % 1000).padStart(3, '0')}`;
}

function boundedText(text) {
  if (typeof text !== 'string' || text.length > MAX_TEXT)
    throw new Error('Use a subtitle file smaller than 2 MB.');
  if (text.includes('\0'))
    throw new Error(
      'Binary input is not a subtitle file. Use UTF-8 SRT or WebVTT.',
    );
  return text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .trim();
}

export function parseSubtitles(text) {
  const source = boundedText(text);
  if (!source) throw new Error('Add subtitles first.');
  const blocks = source.split(/\n[\t ]*\n+/);
  const format = /^WEBVTT(?:[\t \n]|$)/.test(blocks[0]) ? 'vtt' : 'srt';
  const header = format === 'vtt' ? blocks.shift() : '';
  const metadata = [];
  const cues = [];
  for (const [index, block] of blocks.entries()) {
    if (
      format === 'vtt' &&
      /^(NOTE(?:[\t ]|\n|$)|STYLE(?:\n|$)|REGION(?:\n|$))/.test(block)
    ) {
      metadata.push(block);
      continue;
    }
    const lines = block.split('\n');
    let id = '';
    if (!lines[0].includes('-->')) id = lines.shift();
    const match = lines.shift()?.match(/^(\S+)\s+-->\s+(\S+)(?:[\t ]+(.*))?$/);
    if (!match || (format === 'srt' && id && !/^\d+$/.test(id)))
      throw new Error(`Cue ${index + 1}: invalid timing line or cue number.`);
    const start = parseTime(match[1]);
    const end = parseTime(match[2]);
    if (end <= start)
      throw new Error(`Cue ${index + 1}: end must be later than start.`);
    if (!lines.length || !lines.join('\n').trim())
      throw new Error(`Cue ${index + 1}: subtitle text is empty.`);
    if (format === 'srt' && match[3])
      throw new Error(
        `Cue ${index + 1}: SRT positioning extensions are not supported.`,
      );
    const body = lines.join('\n');
    if (format === 'vtt' && /<\d{1,4}:\d{2}(?::\d{2})?\.\d{3}>/.test(body)) {
      throw new Error(
        `Cue ${index + 1}: inline karaoke timestamps need a dedicated editor.`,
      );
    }
    cues.push({
      index: cues.length + 1,
      id,
      start,
      end,
      text: body,
      settings: match[3] ?? '',
    });
    if (cues.length > 20_000)
      throw new Error('The limit is 20,000 subtitle cues.');
  }
  if (!cues.length) throw new Error('No timed subtitle cues were found.');
  if (header && /X-TIMESTAMP-MAP/i.test(header))
    throw new Error(
      'WebVTT timestamp maps are not supported. Export a standalone WebVTT file first.',
    );
  return { format, header, metadata, cues };
}

export function parseCuts(text) {
  if (typeof text !== 'string' || text.length > 100_000)
    throw new Error('Cut list is too large.');
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('#'));
  if (lines.length > 500) throw new Error('The limit is 500 deleted ranges.');
  const cuts = lines
    .map((line, i) => {
      if (i === 0 && /^start\s*,\s*end$/i.test(line)) return null;
      const parts = line.includes('-->') ? line.split('-->') : line.split(',');
      if (parts.length !== 2)
        throw new Error(
          `Range ${i + 1}: use start --> end or a two-column CSV.`,
        );
      const start = parseTime(parts[0]);
      const end = parseTime(parts[1]);
      if (end <= start)
        throw new Error(`Range ${i + 1}: end must be later than start.`);
      return { start, end };
    })
    .filter((cut) => cut !== null)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  for (const cut of cuts) {
    const last = merged.at(-1);
    if (last && cut.start <= last.end) last.end = Math.max(last.end, cut.end);
    else merged.push({ ...cut });
  }
  return merged;
}

export function applyCuts(document, cuts) {
  if (!document?.cues || !Array.isArray(cuts))
    throw new Error('Subtitles and cut ranges are required.');
  if (cuts.length > 500) throw new Error('The limit is 500 deleted ranges.');
  for (let i = 0; i < cuts.length; i++) {
    const { start, end } = cuts[i];
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end <= start ||
      end > MAX_TIME ||
      (i && start < cuts[i - 1].end)
    ) {
      throw new Error(
        'Cut ranges must be sorted, disjoint millisecond intervals.',
      );
    }
  }
  // Prefix totals keep long timelines from rescanning every earlier cut per cue.
  const totals = [0];
  for (const cut of cuts) totals.push(totals.at(-1) + cut.end - cut.start);
  function before(time) {
    let lo = 0,
      hi = cuts.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (cuts[mid].end <= time) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
  function project(time) {
    const i = before(time);
    return time - totals[i] - (cuts[i] ? Math.max(0, time - cuts[i].start) : 0);
  }
  const cues = [],
    changes = [];
  for (const cue of document.cues) {
    let cursor = cue.start;
    const segments = [];
    for (
      let i = before(cursor);
      i < cuts.length && cuts[i].start < cue.end;
      i++
    ) {
      const cut = cuts[i];
      if (cut.start > cursor)
        segments.push([cursor, Math.min(cut.start, cue.end)]);
      cursor = Math.max(cursor, cut.end);
      if (cursor >= cue.end) break;
    }
    if (cursor < cue.end) segments.push([cursor, cue.end]);
    const parts = segments.map(([start, end], i) => ({
      ...cue,
      id: cue.id
        ? `${cue.id}${segments.length > 1 ? `-part-${i + 1}` : ''}`
        : '',
      start: project(start),
      end: project(end),
    }));
    const status =
      parts.length === 0
        ? 'removed'
        : parts.length > 1
          ? 'split'
          : segments[0][0] !== cue.start || segments[0][1] !== cue.end
            ? 'trimmed'
            : parts[0].start !== cue.start
              ? 'shifted'
              : 'unchanged';
    changes.push({ original: cue, parts, status });
    cues.push(...parts);
    if (cues.length > 100_000)
      throw new Error(
        'This cut list produces too many cue fragments. Use fewer cuts.',
      );
  }
  cues.sort((a, b) => a.start - b.start || a.index - b.index);
  return {
    ...document,
    cues,
    changes,
    cuts,
    removedMs: totals.at(-1),
    counts: Object.fromEntries(
      ['removed', 'split', 'trimmed', 'shifted', 'unchanged'].map((status) => [
        status,
        changes.filter((c) => c.status === status).length,
      ]),
    ),
  };
}

export function serializeSubtitles(document) {
  const vtt = document.format === 'vtt';
  const blocks = document.cues.map(
    (cue, i) =>
      `${vtt ? (cue.id ? cue.id + '\n' : '') : i + 1 + '\n'}${formatTime(cue.start, vtt ? '.' : ',')} --> ${formatTime(cue.end, vtt ? '.' : ',')}${vtt && cue.settings ? ' ' + cue.settings : ''}\n${cue.text}`,
  );
  if (vtt) blocks.unshift(document.header || 'WEBVTT', ...document.metadata);
  return blocks.join('\n\n') + '\n';
}

export function retime(subtitleText, cutText) {
  return applyCuts(parseSubtitles(subtitleText), parseCuts(cutText));
}
