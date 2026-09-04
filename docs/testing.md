# Validation notes

## Automated

- 12 Node.js tests, including a retained-millisecond oracle across 210 bounded intervals.
- TypeScript and application lint checks pass. Vendored UI components and their generated mobile hook are excluded from application lint; they are not silently edited to fit local rules.
- Dependency audit against the npm registry reported zero known vulnerabilities after the security-version update. This is not a security-audit guarantee.

## Browser checks

Checked in a Chromium-based browser on Windows with fictional tutorial subtitles:

| Check | Observed result |
| --- | --- |
| Default cut list | 7.500 s removed; 6 output cues |
| Split-only filter | One original cue, two edited timing ranges |
| SRT and JSON downloads | Saved files parsed successfully; timings and text agree |
| Last exported cue | 00:00:22.500–00:00:26.500 |
| 390 px viewport | Document width remains 390 px; inputs stack vertically |

`scripts/verify-downloads.mjs` checks the two sample browser downloads. Screenshots are actual browser captures, not mockups.

## Known validation gaps

- Safari/Firefox and screen-reader end-to-end behavior have not been verified.
- The browser used for testing does not expose `document.modelContext`; the optional WebMCP tools were not verified in a supported runtime. Ordinary editor actions do not require it.
- Vinext's Windows export process can assert during Node/libuv shutdown. Builds with a nonzero exit are considered failures even if HTML files were written. The Linux GitHub Pages workflow is the release build gate; consult its latest run before using a release.

## Scope

This is a strict, bounded subtitle reader, not a complete WebVTT validator. Unsupported timestamp-map and inline-karaoke files are rejected rather than exported with incorrect internal timings. Format reference: [W3C WebVTT](https://w3c.github.io/webvtt/).
