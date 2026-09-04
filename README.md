# CueSplice

Retiming SRT and WebVTT subtitles after removing sections from a video.

A fixed subtitle offset works until you cut something out of the middle. CueSplice takes deleted ranges measured on the original video, removes their elapsed time, and moves later subtitles into place. Cues crossing a cut are trimmed or split; completely removed cues are listed in the change report.

## Current stage

The dependency-free timeline engine and regression tests are available. The browser editor is under development and will follow in a separate update.

```js
import { retime, serializeSubtitles } from './core/timeline.mjs';

const result = retime(srtText, '00:00:08.000 --> 00:00:12.500');
const edited = serializeSubtitles(result);
console.log(result.counts);
```

Run the core tests with Node.js 22 or newer:

```sh
node --test tests/*.test.mjs
```

## Timing rules

- Cut ranges use the **original** video's timeline, not the already-edited timeline.
- Ranges are half-open: the start is deleted; the end is retained.
- Overlapping and touching cuts are merged before subtracting time.
- Time is represented as integer milliseconds. No frame-rate guessing or floating-point accumulation.
- Splitting a cue repeats its text on either side of the cut. Review these cues: software cannot know which spoken words survived.

Supported: UTF-8 SRT and standalone WebVTT, multiline text, WebVTT cue settings and metadata. Limits: 2 million text characters, 20,000 cues, 500 cut ranges, 100,000 output fragments. File-size limits are checked separately by the browser importer.

Not supported: speed ramps, transitions that change timing, EDL/frame-based imports, ASS/SSA styling, WebVTT inline karaoke timestamps or external timestamp maps. This is not a video editor or a subtitle translation tool.

## License

MIT. See [LICENSE](LICENSE).
