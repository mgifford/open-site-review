# Agent Instructions for open-site-review

This file provides guidance for coding agents (AI assistants, Copilot, etc.) working on this repository.

## Project Overview

`open-site-review` is a Node.js CLI tool that scans HTML, CSS, and JavaScript files (or live URLs) for browser-compatibility issues, obsolete polyfills, and modern best-practice adoption opportunities. It uses:

- **caniuse-api** — browser support data
- **@mdn/browser-compat-data** — deprecation and standards status
- **browserslist** — configurable browser target queries
- **@projectwallace/css-analyzer** and **@projectwallace/css-code-quality** — CSS quality metrics

## Repository Layout

```
open-site-review/
├── src/
│   ├── cli.js              # Entry point; argument parsing and output dispatch
│   ├── scanner.js          # Core file-scanning logic
│   ├── url-scan.js         # URL / crawl scanning
│   ├── rules.js            # Compatibility and polyfill detection rules
│   ├── support.js          # Browserslist + caniuse-api support calculations
│   ├── css-quality.js      # Project Wallace CSS quality integration
│   ├── reporters.js        # Output formatters (markdown, JSON, GitHub annotations)
│   └── github-issues.js    # GitHub issue body URL extraction
├── examples/               # Sample HTML/CSS/JS files used for demo scans
├── scripts/
│   └── update-pages-index.js  # Regenerates the GitHub Pages reports index
├── docs/
│   └── reports/            # Published scan reports (GitHub Pages)
├── .github/
│   └── workflows/
│       └── site-review.yml # CI workflow: PR scans + SCAN: issue queue
├── open-site-review.config.json  # Default configuration
├── package.json
└── README.md
```

## Setup and Running

```bash
npm install          # Install dependencies (no build step required)
npm run scan         # Scan using defaults from open-site-review.config.json
npm run scan:example # Scan the examples/ directory and print markdown
npm run scan:ci      # Scan with GitHub Actions annotation output
```

There is **no compile or transpile step** — the project is plain CommonJS Node.js.  
There are **no automated tests** in the repository yet. Manual verification is done by running the CLI against example files or live URLs.

## Making Changes

- All scanner logic lives in `src/`. Each module has a focused responsibility.
- Rules are defined in `src/rules.js` as plain arrays/objects — add new detectors there.
- Output formats are in `src/reporters.js` — extend there for new output modes.
- CSS quality analysis is self-contained in `src/css-quality.js`.
- The GitHub Actions workflow (`.github/workflows/site-review.yml`) uses `npm ci` and Node 22.
- When adding a new npm dependency, run `npm install <package>` (not `npm ci`) locally; commit both `package.json` and `package-lock.json`.

## Configuration

Default config: `open-site-review.config.json`. Key fields:

| Field | Description |
|---|---|
| `scanMode` | `"files"` or `"urls"` |
| `targets` | Browserslist query (e.g. `"defaults, not ie <= 11"`) |
| `paths` | Glob patterns to scan in file mode |
| `urls` | URLs to scan in URL mode |
| `issue` | GitHub issue reference whose body contains URLs |
| `maxUrls` | Cap on URLs extracted from an issue |
| `audienceWeights` | Optional browser-family weighting map |
| `unsupportedThresholdPercent` | Threshold above which a feature is flagged `too-new` |
| `removableThresholdPercent` | Threshold below which a polyfill is flagged `possibly-obsolete-polyfill` |

## GitHub Actions / CI

The workflow `.github/workflows/site-review.yml` runs on:

- **Pull requests** — scans files in the repo and uploads a markdown report artifact.
- **Issues** — when an issue title starts with `SCAN:`, reads URLs from the body, runs a scan, posts a comment, publishes to GitHub Pages, and closes the issue.
- **Scheduled** (daily) and **workflow_dispatch** — processes any open `SCAN:` issues.

To run a URL scan via issue automation, open an issue with a title starting with `SCAN:` and paste the target URLs in the body.

## GitHub Pages

Reports are published to `docs/reports/`. The Pages source is the `main` branch, `/docs` folder.  
The index page at `https://<owner>.github.io/<repo>/` links to `reports.html`.

## Known Limitations

- No automated test suite (manual testing via CLI examples).
- Rule coverage is intentionally small; contributions expanding `src/rules.js` are welcome.
- URL crawling is shallow (linked CSS/JS assets only, no recursive page crawling).

## Errors and Workarounds

- If `npm ci` fails due to a missing `package-lock.json`, run `npm install` first to regenerate it.
- If the GitHub Actions push step fails due to a concurrent commit, the workflow retries up to three times with exponential backoff.
