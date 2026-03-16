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

## New in v0.2

- Scan local files or live URLs.
- Optionally crawl linked CSS/JS assets from target pages.
- Use audience-weighted scoring to reflect your real browser mix.
- Emit GitHub Actions annotations for pull request feedback.

## What it reports

Current rules detect and classify:

- Modern features that may be too new for target browsers.
- Polyfills likely obsolete for current targets.
- Legacy patterns with modern native alternatives.

Expanded detectors now include examples such as:

- Native UI features: `<dialog>`, `<details>`, and HTML `popover`.
- Modern CSS capabilities: `:has()`, container queries, and `subgrid`.
- Modern JS syntax and APIs: optional chaining and nullish coalescing.
- Legacy anti-patterns: `document.write` and synchronous XHR.
- Polyfill review signals: `polyfill.io`, `core-js`, `regenerator-runtime`, IntersectionObserver/ResizeObserver/Web Components polyfills.

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
node src/cli.js --urls "https://example.org,https://example.org/about" --format markdown
node src/cli.js --urls "https://example.org" --all-assets --format markdown
node src/cli.js --issue "https://github.com/mgifford/open-site-review/issues/1" --max-urls 25 --format markdown
node src/cli.js --issue "mgifford/open-site-review#1" --format markdown
node src/cli.js --audience-weights '{"chrome":0.45,"safari":0.30,"firefox":0.15,"edge":0.10}'
node src/cli.js --format github --ci
```

## Configuration

Default config file: `open-site-review.config.json`

Key options:

- `scanMode`: `files` or `urls`.
- `targets`: Browserslist query string.
- `paths`: Glob patterns to scan.
- `urls`: Page URLs to scan in URL mode.
- `issue`: GitHub issue reference whose body contains URLs to scan.
- `maxUrls`: Cap URL count from `urls` or `issue` inputs.
- `sameOriginOnly`: In URL mode, keep linked-asset crawling on the same origin.
- `audienceWeights`: Optional browser-family weighting map for compatibility scoring.
- `unsupportedThresholdPercent`: If modern feature unsupported share is above this, mark as `too-new`.
- `removableThresholdPercent`: If polyfill-related support gap is below this, mark as `possibly-obsolete-polyfill`.

When `audienceWeights` is set, the scanner reports both raw unsupported share and weighted unsupported share.

## GitHub Actions integration

This repository includes a workflow that runs on pull requests and emits scanner annotations in CI logs.

- Workflow file: `.github/workflows/site-review.yml`
- Command used: `npm run scan:ci`
- Output includes `::warning` / `::error` annotations for findings.

Issue automation behavior:

- On issue `opened` and `reopened`, the workflow runs only when the title starts with `SCAN:`.
- For `SCAN:` issues, it reads URLs from the issue body and runs a scan.
- It posts the report as an issue comment and publishes it to GitHub Pages.
- Reports index page is published at `https://<owner>.github.io/<repo>/reports.html`.
- After successful processing and report generation, it closes the `SCAN:` issue automatically.
- If a `SCAN:` issue is reopened later, the scan runs again and closes it again after reporting.
- Non-`SCAN:` issues are ignored by this automation and remain open.

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

- Expand rule packs for accessibility and performance anti-patterns.
- Add JavaScript/CSS AST-level detectors for stronger precision.
- Add configurable recommendation templates by severity.
