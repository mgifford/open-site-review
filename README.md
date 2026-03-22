# open-site-review

Compatibility and front-end practice scanner for HTML, CSS, and JavaScript.

This project is intended to answer questions like:

- Are we using features that are too new for our audience?
- Are we carrying polyfills that are no longer needed?
- Where can native web platform features reduce JavaScript and improve performance?

For an exhaustive description of every built-in feature and a detailed roadmap of possible future enhancements, see [FEATURES.md](FEATURES.md).

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

## CSS Quality Analysis

For every CSS file scanned, the tool also runs a CSS quality and analysis pass powered by [Project Wallace](https://www.projectwallace.com/):

- **Code Quality Scores** — Performance, Maintainability, and Complexity scores (0–100) for each CSS file, with a list of any quality violations found.
  See [css-code-quality](https://github.com/projectwallace/css-code-quality) for the full list of checks.
- **Complexity Metrics** — Source lines of code, total rules, selectors, declarations, `!important` count, and maximum selector specificity.
  Powered by [css-analyzer](https://github.com/projectwallace/css-analyzer).
- **Design Tokens** — Unique CSS custom properties (variables), colors, font families, font sizes, and z-index values extracted from each file.

These insights appear in both Markdown and JSON output formats and complement the browser-compatibility findings.

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
- Reports index page is published at `https://<owner>.github.io/<repo>/reports/`.
- The home page at `https://<owner>.github.io/<repo>/` links to the reports listing.
- Configure GitHub Pages source to `main` branch and `/docs` folder.
- After successful processing and report generation, it closes the `SCAN:` issue automatically.
- If a `SCAN:` issue is reopened later, the scan runs again and closes it again after reporting.
- Manually triggered scans (via `workflow_dispatch` with an issue reference) also comment and close the issue after reporting.
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

## AI Disclosure

This section documents the use of AI tools in this project.

### Used to build this project

- **GitHub Copilot Coding Agent (Claude Sonnet, via GitHub Copilot)** — Used extensively to develop this project. All pull requests from the initial prototype through ongoing feature development and bug fixes were authored by the GitHub Copilot Coding Agent. This covers code generation, documentation, GitHub Actions workflow authoring, and architectural decisions across the entire `src/` directory and project configuration. Also used to upgrade GitHub Actions from Node.js 20 to Node.js 24 runtime versions, and to author the exhaustive `FEATURES.md` feature reference and future-enhancements documentation.

### Used when running this program

No AI or LLM is used at runtime. The tool relies entirely on static, pre-published datasets:

- **caniuse-api** — browser support data sourced from the Can I Use database.
- **@mdn/browser-compat-data** — browser compatibility metadata from MDN.
- **browserslist** — resolves browser target queries to specific browser versions.
- **@projectwallace/css-analyzer** and **@projectwallace/css-code-quality** — static CSS analysis engines.

All analysis is deterministic and rule-based. No network calls to AI services are made during a scan.

### Browser-based AI

No browser-based AI is used in this application. The tool is a server-side CLI; it does not ship any client-side JavaScript and has no browser runtime component.

## Related tools and resources

### Web Almanac

The [Web Almanac](https://almanac.httparchive.org/) by HTTP Archive is a comprehensive annual report on the state of the web, backed by real-world usage data from millions of websites. It provides valuable context on which HTML, CSS, and JavaScript features are commonly used in the wild — useful for calibrating rule thresholds and understanding real-world adoption.

Relevant chapters:

- **[2024 Markup](https://almanac.httparchive.org/en/2024/markup)** — Covers how HTML is written and structured across the web, including element adoption rates and structural patterns such as `<dialog>`, `<details>`, and modern semantic elements.
- **[2022 CSS](https://almanac.httparchive.org/en/2022/css)** — Documents the adoption of modern CSS features, usage patterns, and the state of CSS quality across real websites, including data on selectors, custom properties, and layout techniques. (Most recent published CSS edition.)

The Web Almanac data can guide decisions about which modern features to promote or which legacy patterns to flag when configuring scan thresholds.

### Project Wallace

[Project Wallace](https://www.projectwallace.com/) is a CSS analytics platform for visualizing and understanding your CSS. It is a great place to learn more about CSS complexity, quality, and maintainability.

Tools in the Project Wallace ecosystem that are integrated into this tool:

- **[css-analyzer](https://github.com/projectwallace/css-analyzer)** – Static analysis of CSS, exposing detailed metrics on selectors, properties, values, colors, specificity, and more. Powers the CSS Complexity Metrics and Design Tokens sections of the report.
- **[css-code-quality](https://github.com/projectwallace/css-code-quality)** – Calculates CSS Code Quality scores across Performance, Maintainability, and Complexity categories. Powers the Code Quality Scores section of the report.

Additional Project Wallace tools:

- **[wallace-cli](https://github.com/projectwallace/wallace-cli)** – Command-line interface for running CSS analysis locally.
- **[color-sorter](https://github.com/projectwallace/color-sorter)** – Sorts CSS colors by format, hue, whiteness, and lightness.

For deeper exploration of your CSS, visit:

- [https://www.projectwallace.com/css-code-quality](https://www.projectwallace.com/css-code-quality)
- [https://www.projectwallace.com/analyze-css](https://www.projectwallace.com/analyze-css)
- [https://www.projectwallace.com/design-tokens](https://www.projectwallace.com/design-tokens)
