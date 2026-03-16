# open-site-review

Compatibility and front-end practice scanner for HTML, CSS, and JavaScript.

This project is intended to answer questions like:

- Are we using features that are too new for our audience?
- Are we carrying polyfills that are no longer needed?
- Where can native web platform features reduce JavaScript and improve performance?

## Why this approach

The scanner combines:

- Can I Use data via `caniuse-api` for browser support checks.
- MDN Browser Compatibility Data for metadata such as deprecation and standards status.
- Browserslist target queries so decisions are based on your browser policy.

This gives practical guidance on balancing backward compatibility with progressive enhancement.

## What it reports

Current rules detect and classify:

- Modern features that may be too new for target browsers.
- Polyfills likely obsolete for current targets.
- Legacy patterns with modern native alternatives.

Severity is based on unsupported share of your configured targets.

## Install and run

```bash
npm install
npm run scan
```

Run against only demo files:

```bash
npm run scan:example
```

CLI usage:

```bash
node src/cli.js --help
node src/cli.js --targets "defaults, not ie <= 11" --format json
node src/cli.js --paths "src/**/*.{html,css,js},public/**/*.{html,css,js}"
```

## Configuration

Default config file: `open-site-review.config.json`

Key options:

- `targets`: Browserslist query string.
- `paths`: Glob patterns to scan.
- `unsupportedThresholdPercent`: If modern feature unsupported share is above this, mark as `too-new`.
- `removableThresholdPercent`: If polyfill-related support gap is below this, mark as `possibly-obsolete-polyfill`.

## Insights this can surface

- Replace JavaScript UI helpers with native elements (for example `<dialog>`) where support allows.
- Retire broad polyfill bundles and use targeted conditional polyfills.
- Remove or reduce legacy dependencies where native APIs now cover use cases.
- Improve startup time by cutting script bytes and parse/execute work.

## Current limits

- Rule coverage is intentionally small in this first version.
- Support scoring uses equal weighting across resolved targets.
- URL crawling and deep AST analysis are not yet implemented.

## Next improvements

- Add feature extraction from live URLs and linked assets.
- Integrate real audience weighting from analytics or custom stats.
- Expand rule packs for accessibility and performance anti-patterns.
- Add CI output and pull request annotations.
