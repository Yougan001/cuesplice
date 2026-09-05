# Changelog

## 0.1.0 — 2026-09-05

First public release.

- Retimes UTF-8 SRT and standalone WebVTT after deleted video ranges.
- Merges overlapping cuts and uses integer-millisecond, half-open intervals.
- Reports unchanged, shifted, trimmed, split and removed cues.
- Imports subtitle files and cut lists; exports subtitles and a JSON change report.
- Runs locally in the browser, with a dependency-free timeline engine.
- Includes 12 automated tests, real desktop/mobile screenshots and documented validation limits.

Split and trimmed cues need text review. Speed changes, ASS/SSA, EDL, inline karaoke timestamps and external WebVTT timestamp maps are not supported. Offline page loading is not provided.
