import type { retime } from '@/core/timeline.mjs';
type Report = ReturnType<typeof retime>;
type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
type Context = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};

function summary(report: Report | null) {
  return report
    ? {
        format: report.format,
        removedMs: report.removedMs,
        inputCues: report.changes.length,
        outputCues: report.cues.length,
        counts: report.counts,
      }
    : { ready: false };
}
export function registerTimelineTools(actions: {
  apply: (source: string, cuts: string) => Report;
  read: () => Report | null;
}) {
  const context = (document as Document & { modelContext?: Context })
    .modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  const tools: Tool[] = [
    {
      name: 'retime_subtitles',
      description:
        'Replace the editor inputs, apply original-timeline video cuts, and display the subtitle change report. Does not download or upload files.',
      inputSchema: {
        type: 'object',
        properties: {
          subtitles: { type: 'string', maxLength: 2000000 },
          cuts: { type: 'string', maxLength: 100000 },
        },
        required: ['subtitles', 'cuts'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        if (!input || typeof input !== 'object')
          throw new Error('Expected subtitles and cuts.');
        const values = input as Record<string, unknown>;
        if (
          typeof values.subtitles !== 'string' ||
          typeof values.cuts !== 'string' ||
          Object.keys(values).some(
            (key) => key !== 'subtitles' && key !== 'cuts',
          )
        )
          throw new Error('Expected only the subtitles and cuts strings.');
        return summary(actions.apply(values.subtitles, values.cuts));
      },
    },
    {
      name: 'read_retiming_summary',
      description:
        'Read the summary of the currently displayed subtitle retiming report.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute() {
        return summary(actions.read());
      },
    },
  ];
  for (const tool of tools) {
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {}
  }
  return () => lifecycle.abort();
}
