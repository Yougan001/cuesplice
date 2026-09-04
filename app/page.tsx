'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import {
  Scissors,
  Upload,
  ArrowDownToLine,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import {
  retime,
  serializeSubtitles,
  formatTime,
  parseSubtitles,
  type ChangeStatus,
} from '@/core/timeline.mjs';
import { SAMPLE_SUBTITLES, SAMPLE_CUTS } from '@/lib/sample';
import { saveText } from '@/lib/download';
import { registerTimelineTools } from '@/lib/browser-tools';

type Report = ReturnType<typeof retime>;
const initial = retime(SAMPLE_SUBTITLES, SAMPLE_CUTS);
const statusLabels: Record<ChangeStatus, string> = {
  unchanged: 'Unchanged',
  shifted: 'Shifted',
  trimmed: 'Trimmed',
  split: 'Split — review',
  removed: 'Removed',
};
const PAGE_SIZE = 30;

function Timeline({ report }: { report: Report }) {
  const duration = Math.max(
    ...report.changes.map((c) => c.original.end),
    ...report.cuts.map((c) => c.end),
    1,
  );
  const segments: { start: number; end: number; cut: boolean }[] = [];
  let cursor = 0;
  for (const cut of report.cuts) {
    if (cut.start > cursor)
      segments.push({ start: cursor, end: cut.start, cut: false });
    segments.push({ ...cut, cut: true });
    cursor = cut.end;
  }
  if (cursor < duration)
    segments.push({ start: cursor, end: duration, cut: false });
  return (
    <>
      <div className="time-axis">
        <span>00:00</span>
        <span>{formatTime(Math.round(duration / 2))}</span>
        <span>{formatTime(duration)}</span>
      </div>
      <div
        className="timeline"
        aria-label="Original timeline with deleted ranges"
      >
        {segments.map((s, i) => (
          <div
            key={i}
            className={s.cut ? 'cut-segment' : 'keep-segment'}
            style={{ width: ((s.end - s.start) / duration) * 100 + '%' }}
            title={
              (s.cut ? 'Delete ' : 'Keep ') +
              formatTime(s.start) +
              ' to ' +
              formatTime(s.end)
            }
          >
            {s.cut ? 'Cut' : 'Keep'}
          </div>
        ))}
      </div>
    </>
  );
}

export default function Home() {
  const [source, setSource] = useState(SAMPLE_SUBTITLES),
    [cuts, setCuts] = useState(SAMPLE_CUTS);
  const [filename, setFilename] = useState('frame-tutorial.srt');
  const [report, setReport] = useState<Report | null>(initial);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('all'),
    [page, setPage] = useState(0),
    [reading, setReading] = useState(false);
  const subtitleInput = useRef<HTMLInputElement>(null),
    cutsInput = useRef<HTMLInputElement>(null);
  const importRevision = useRef(0),
    currentReport = useRef<Report | null>(initial);
  const calculate = useCallback((text: string, ranges: string) => {
    const result = retime(text, ranges);
    currentReport.current = result;
    setReport(result);
    setPage(0);
    setError('');
    setNotice('');
    return result;
  }, []);
  function invalidate() {
    importRevision.current++;
    setReading(false);
    setReport(null);
    currentReport.current = null;
    setError('');
    setNotice('');
    setPage(0);
  }
  function apply() {
    try {
      calculate(source, cuts);
    } catch (e) {
      setReport(null);
      currentReport.current = null;
      setError((e as Error).message);
      setNotice('');
    }
  }
  function sample() {
    importRevision.current++;
    setReading(false);
    setSource(SAMPLE_SUBTITLES);
    setCuts(SAMPLE_CUTS);
    setFilename('frame-tutorial.srt');
    setFilter('all');
    calculate(SAMPLE_SUBTITLES, SAMPLE_CUTS);
  }
  async function importFile(
    file: File | undefined,
    kind: 'subtitles' | 'cuts',
  ) {
    if (!file) return;
    const revision = ++importRevision.current;
    setReading(true);
    setNotice('');
    try {
      const maximum = kind === 'subtitles' ? 2_000_000 : 100_000;
      if (file.size > maximum)
        throw new Error(
          kind === 'subtitles'
            ? 'Use a subtitle file smaller than 2 MB.'
            : 'Cut list must be smaller than 100 KB.',
        );
      const text = new TextDecoder('utf-8', { fatal: true }).decode(
        await file.arrayBuffer(),
      );
      if (kind === 'subtitles') parseSubtitles(text);
      if (revision !== importRevision.current) return;
      if (kind === 'subtitles') {
        setSource(text);
        setFilename(file.name);
      } else setCuts(text);
      setReport(null);
      currentReport.current = null;
      setPage(0);
      setError('');
    } catch (e) {
      if (revision === importRevision.current) setError((e as Error).message);
    } finally {
      if (revision === importRevision.current) setReading(false);
    }
  }
  function download(kind: 'subtitles' | 'report') {
    if (!report) return;
    const stem =
      filename
        .replace(/\.(srt|vtt)$/i, '')
        .replace(/[<>:"/\\|?*]|\p{Cc}/gu, '_') || 'subtitles';
    saveText(
      kind === 'subtitles'
        ? serializeSubtitles(report)
        : JSON.stringify(
            { source: filename, cutTimebase: 'original', ...report },
            null,
            2,
          ),
      kind === 'subtitles'
        ? `${stem}.edited.${report.format}`
        : `${stem}.changes.json`,
      kind === 'subtitles' ? 'text/plain;charset=utf-8' : 'application/json',
    );
    setNotice('Download requested. Your original file has not been changed.');
  }
  useEffect(
    () =>
      registerTimelineTools({
        apply: (text, ranges) => {
          const result = retime(text, ranges);
          flushSync(() => {
            importRevision.current++;
            setReading(false);
            setSource(text);
            setCuts(ranges);
            setFilename('subtitles.' + result.format);
            currentReport.current = result;
            setReport(result);
            setPage(0);
            setError('');
            setNotice('');
          });
          return result;
        },
        read: () => currentReport.current,
      }),
    [calculate],
  );
  const filtered =
    report?.changes.filter((c) => filter === 'all' || c.status === filter) ??
    [];
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  return (
    <div className="editor">
      <header>
        <Link className="wordmark" href="/">
          <Scissors />
          CueSplice
        </Link>
        <span>SUBTITLE EDIT DESK</span>
        <a
          href="https://github.com/Yougan001/cuesplice"
          target="_blank"
          rel="noreferrer"
        >
          Source ↗
        </a>
      </header>
      <main>
        <div className="title-row">
          <div>
            <p className="eyebrow">CUT THE VIDEO. KEEP THE WORDS IN SYNC.</p>
            <h1>Close the gaps.</h1>
            <p>Apply deleted video ranges to an SRT or WebVTT file.</p>
          </div>
          <span className="local-label">No video upload needed</span>
        </div>
        <div className="desk">
          <section className="input-panel" aria-label="Subtitle inputs">
            <h2>
              <span>01</span> Original subtitles
            </h2>
            <div className="import-actions">
              <Button
                variant="outline"
                onClick={() => subtitleInput.current?.click()}
              >
                <Upload /> Import .srt / .vtt
              </Button>
              <Button
                variant="ghost"
                onClick={sample}
                title="Reset to the example"
              >
                <RotateCcw /> Sample
              </Button>
            </div>
            <input
              ref={subtitleInput}
              type="file"
              accept=".srt,.vtt,text/vtt"
              className="file-input"
              aria-label="Subtitle file"
              onChange={(e) => {
                void importFile(e.target.files?.[0], 'subtitles');
                e.target.value = '';
              }}
            />
            <p className="filename">{filename}</p>
            <Textarea
              className="subtitle-editor"
              aria-label="Original subtitles"
              spellCheck={false}
              value={source}
              onChange={(e) => {
                invalidate();
                setSource(e.target.value);
                setFilename('pasted-subtitles.srt');
              }}
            />
            <h2>
              <span>02</span> Deleted video ranges
            </h2>
            <p className="hint">
              Use timestamps from the <strong>original, uncut</strong> video.
              One deleted range per line.
            </p>
            <Textarea
              aria-label="Deleted video ranges"
              spellCheck={false}
              value={cuts}
              onChange={(e) => {
                invalidate();
                setCuts(e.target.value);
              }}
              rows={4}
            />
            <div className="import-actions">
              <Button
                variant="ghost"
                onClick={() => cutsInput.current?.click()}
              >
                <Upload /> Import cut list
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  invalidate();
                  setCuts('');
                }}
              >
                Clear cuts
              </Button>
            </div>
            <input
              ref={cutsInput}
              type="file"
              accept=".txt,.csv"
              className="file-input"
              aria-label="Cut list file"
              onChange={(e) => {
                void importFile(e.target.files?.[0], 'cuts');
                e.target.value = '';
              }}
            />
            <Button className="primary" disabled={reading} onClick={apply}>
              Apply cuts
            </Button>
            {reading && <output className="hint">Reading file…</output>}
            <Collapsible className="help">
              <CollapsibleTrigger>
                Cut-list format <ChevronDown size={15} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <p>
                  Use <code>00:08.000 --&gt; 00:12.500</code> or two CSV
                  columns: <code>8,12.5</code>. An optional{' '}
                  <code>start,end</code> header is accepted. Overlapping cuts
                  are merged.
                </p>
                <p>
                  No cuts? The timings are kept unchanged. Speed changes and
                  frame-based EDL files are not supported.
                </p>
              </CollapsibleContent>
            </Collapsible>
          </section>
          <section className="output-panel" aria-label="Retiming report">
            <div className="panel-heading">
              <h2>Timeline</h2>
              <span>ORIGINAL → EDITED</span>
            </div>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            {notice && <output className="download-notice">{notice}</output>}
            {report ? (
              <>
                <Timeline report={report} />
                <div className="receipt">
                  <strong>{(report.removedMs / 1000).toFixed(3)} s</strong>
                  <span>
                    total cut duration · {report.cues.length.toLocaleString()}{' '}
                    output cues
                  </span>
                </div>
                <div className="review-note">
                  Review split and trimmed cues. Their text is preserved, so
                  words spoken during a deleted section may need editing.
                </div>
                <div className="review-heading">
                  <h2>What changes</h2>
                  <NativeSelect
                    aria-label="Filter cue changes"
                    value={filter}
                    onChange={(e) => {
                      setFilter(e.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="all">
                      All {report.changes.length} cues
                    </option>
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label} ({report.counts[key as ChangeStatus]})
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="cue-list">
                  {visible.map((change) => (
                    <article
                      key={change.original.index}
                      className={'cue-row ' + change.status}
                    >
                      <span className="cue-index">
                        {String(change.original.index).padStart(2, '0')}
                      </span>
                      <div className="cue-body">
                        <div className="old-time">
                          {formatTime(change.original.start)} →{' '}
                          {formatTime(change.original.end)}
                        </div>
                        {change.parts.map((cue, i) => (
                          <code key={i}>
                            {formatTime(cue.start)} → {formatTime(cue.end)}
                          </code>
                        ))}
                        <p>{change.original.text}</p>
                      </div>
                      <em>{statusLabels[change.status]}</em>
                    </article>
                  ))}
                </div>
                {!visible.length && (
                  <p className="hint">No cues match this filter.</p>
                )}
                <Pagination
                  className="cue-pagination"
                  aria-label="Cue report pages"
                >
                  <PaginationContent>
                    <PaginationItem>
                      <Button
                        variant="outline"
                        disabled={page === 0}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        Previous
                      </Button>
                    </PaginationItem>
                    <PaginationItem>
                      <span>
                        Page {page + 1} / {pages}
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <Button
                        variant="outline"
                        disabled={page + 1 >= pages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
                <div className="export-actions">
                  <Button onClick={() => download('subtitles')}>
                    <ArrowDownToLine /> Export .{report.format}
                  </Button>
                  <Button variant="outline" onClick={() => download('report')}>
                    Change report
                  </Button>
                </div>
                {report.cues.length === 0 && (
                  <p className="hint">
                    Every cue was removed. The subtitle export will contain no
                    timed cues.
                  </p>
                )}
              </>
            ) : (
              <div className="pending-report">
                <Scissors size={30} />
                <h2>Ready to retime</h2>
                <p>
                  Apply your cut list to see the edited timeline and a
                  cue-by-cue report.
                </p>
                <p className="hint">
                  The previous result is cleared whenever an input changes.
                </p>
              </div>
            )}
          </section>
        </div>
        <footer>
          <span>UTF-8 SRT / WebVTT · 20,000 cues · 500 cut ranges</span>
          <span>Local processing. No accounts, analytics or file uploads.</span>
        </footer>
      </main>
    </div>
  );
}
