# Contributing to CueSplice

Small, reproducible timing examples are particularly useful. English and Chinese reports are welcome.

## Report a problem

Use the [timing issue form](https://github.com/Yougan001/cuesplice/issues/new?template=timing-problem.yml). Include a few invented subtitle cues, the deleted ranges on the **original** video timeline, and the timestamps you expected after editing. Add your browser/version or Node.js version if you use the engine directly.

Do not upload private recordings or someone else's full subtitle file. Three short cues are usually enough to show a boundary error. A screenshot helps with layout problems, but text inputs are needed to reproduce timing problems.

Before proposing a new format, check the README's supported inputs. Speed changes, EDL timecodes, ASS styling and translation are outside the current scope.

## Make a change

Use Node.js 22.13+ and the committed lockfile:

```sh
npm ci
npm test
npm run lint
npm run typecheck
```

Keep timeline rules in `core/timeline.mjs`, independent of the browser. A timing fix should include a failing example in `tests/timeline.test.mjs`, with explicit expected output times. Cuts use half-open intervals and integer milliseconds; do not replace those rules with approximate floating-point offsets.

For editor changes, check the sample, an empty cut list, an invalid range and the exported SRT. Also check a narrow viewport if controls or layout changed. Split cues repeat their text by design, so the review warning must remain.

Run `npm run build` before submitting when your environment supports it. The known Windows export failure is documented in [testing notes](docs/testing.md); a nonzero exit is not success. The Linux Pages workflow is the release build gate.

Keep a pull request focused on one problem. Explain the change, how you checked it, and any remaining limitations. Please do not add accounts, analytics or upload services to solve a local editing problem.
