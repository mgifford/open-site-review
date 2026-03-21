# open-site-review — Feature Reference

This document provides an exhaustive description of every feature currently built into the `open-site-review` scanner, followed by a detailed section on possible future enhancements.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Scan Modes](#2-scan-modes)
3. [CLI Interface](#3-cli-interface)
4. [Configuration Reference](#4-configuration-reference)
5. [Detection Rules](#5-detection-rules)
   - 5.1 [Modern-Feature Rules](#51-modern-feature-rules)
   - 5.2 [Polyfill Rules](#52-polyfill-rules)
   - 5.3 [Legacy-Pattern Rules](#53-legacy-pattern-rules)
6. [Browser-Support Evaluation](#6-browser-support-evaluation)
7. [CSS Quality Analysis](#7-css-quality-analysis)
8. [Severity Classification](#8-severity-classification)
9. [Output Formats](#9-output-formats)
10. [GitHub Actions Integration](#10-github-actions-integration)
11. [GitHub Issue Automation](#11-github-issue-automation)
12. [GitHub Pages Publishing](#12-github-pages-publishing)
13. [Possible Future Enhancements](#13-possible-future-enhancements)

---

## 1. Overview

`open-site-review` is a Node.js CLI tool and GitHub Actions workflow that scans HTML, CSS, and JavaScript sources for:

- **Browser-compatibility problems** — features that are too new for your configured browser targets.
- **Obsolete polyfills** — polyfills whose feature gaps have closed for your target audience.
- **Legacy anti-patterns** — deprecated APIs and practices with modern native replacements.
- **CSS quality and complexity** — maintainability scores, design token extraction, and structural metrics.

Scanning can target **local files** (via glob patterns) or **live URLs** (single pages, lists, or URLs discovered from a GitHub issue body). All decisions are driven by your own [Browserslist](https://browsersl.ist/) query so results are always relative to *your* browser policy, not a global average.

---

## 2. Scan Modes

### 2.1 File Mode (default)

Scans local files matched by one or more glob patterns.

- **Trigger**: `scanMode: "files"` (default) or `--paths` CLI flag.
- **File discovery**: Uses [`fast-glob`](https://github.com/mrmlnc/fast-glob) to expand patterns.
- **File types supported**: `.html`, `.htm`, `.css`, `.js`, `.mjs`, `.cjs`.
- **Default glob**: `**/*.{html,htm,css,js,mjs,cjs}`.
- **Default ignored paths**: `node_modules/**`, `dist/**`, `build/**`, `.git/**`.

### 2.2 URL Mode

Fetches and scans live pages and their linked assets.

- **Trigger**: `scanMode: "urls"` or `--urls` CLI flag.
- **HTTP client**: Node.js native `fetch` with a 15-second abort timer.
- **User-Agent**: `open-site-review/<version>` (currently `open-site-review/0.2`, reflecting the version in `package.json`).
- **Redirect following**: Automatic.
- **Asset extraction**: Parses `<script src="...">` and `<link rel="stylesheet" href="...">` from HTML pages and fetches each linked CSS and JS asset.
- **Same-origin filtering**: By default (`sameOriginOnly: true`) only same-origin assets are followed. Use `--all-assets` (or `sameOriginOnly: false`) to include cross-origin assets.
- **Deduplication**: URLs already fetched are tracked in a Set to avoid redundant requests.
- **Error handling**: Fetch errors are captured separately and reported alongside findings.

### 2.3 GitHub Issue URL Discovery

Automatically discovers URLs to scan from a GitHub issue body.

- **Trigger**: `--issue owner/repo#number` or `--issue <full issue URL>`.
- **Authentication**: Uses `GITHUB_TOKEN` or `GH_TOKEN` environment variable if available (allows private repos and avoids rate limits).
- **Discovery order**:
  1. If the issue body already contains explicit URLs, those are used directly.
  2. If the body contains a root domain URL, the tool first attempts to fetch `/sitemap.xml` (including sitemap index files).
  3. Falls back to a BFS crawl of same-origin HTML links if no sitemap is found.
- **URL filtering**: Ignores non-HTML resources (PDFs, images, fonts, archives, etc.).
- **Issue body update**: Discovered URLs are written back to the issue body with a timestamp for reproducibility.
- **URL cap**: `maxUrls` limits how many URLs are processed.

---

## 3. CLI Interface

```
node src/cli.js [options]
```

| Flag | Argument | Default | Description |
|---|---|---|---|
| `--config` | path | `open-site-review.config.json` | Path to JSON config file |
| `--paths` | glob,glob,… | `**/*.{html,htm,css,js,mjs,cjs}` | Glob patterns for file-mode scan |
| `--urls` | url,url,… | — | Comma-separated page URLs for URL-mode scan |
| `--issue` | `owner/repo#N` or issue URL | — | Load URLs from a GitHub issue body |
| `--max-urls` | number | — | Cap on number of URLs to scan |
| `--targets` | Browserslist query | `defaults, not ie <= 11` | Browser targets for compatibility scoring |
| `--format` | `markdown` / `json` / `github` | `markdown` | Output format |
| `--audience-weights` | JSON string | — | Per-browser-family weights (e.g. `'{"chrome":0.45,"safari":0.30}'`) |
| `--all-assets` | (flag) | same-origin only | Include cross-origin JS/CSS assets in URL mode |
| `--ci` | (flag) | false | Emit GitHub Actions-style annotations alongside Markdown |
| `--help` | (flag) | — | Print help text and exit |

### Argument parsing notes

- `--paths` and `--urls` support comma-separated lists while respecting brace-expansion patterns like `{html,css}`.
- `--audience-weights` accepts a JSON string. Keys are browser family names; values are numeric weights (they are normalised to sum to 1.0 internally).
- Config file, if present, is merged *under* CLI flags: CLI always wins.
- `--issue` triggers `scanMode: "urls"` automatically.

### npm scripts

| Script | Description |
|---|---|
| `npm run scan` | Scan using defaults from `open-site-review.config.json` |
| `npm run scan:example` | Scan `examples/` directory, Markdown output |
| `npm run scan:ci` | Scan with GitHub Actions annotation output |
| `npm run scan:url` | Scan `https://example.com`, Markdown output |
| `npm run scan:issue` | Scan URLs from issue `mgifford/open-site-review#1` |

---

## 4. Configuration Reference

Default config file: `open-site-review.config.json`

| Field | Type | Default | Description |
|---|---|---|---|
| `scanMode` | `"files"` \| `"urls"` | `"files"` | How sources are loaded |
| `targets` | string | `"defaults, not ie <= 11"` | Browserslist query for browser support evaluation |
| `paths` | string[] | `["**/*.{html,htm,css,js,mjs,cjs}"]` | Glob patterns for file mode |
| `ignore` | string[] | `["node_modules/**", "dist/**", "build/**", ".git/**"]` | Glob patterns to exclude |
| `urls` | string[] | `[]` | URLs to scan in URL mode |
| `issue` | string \| null | `null` | GitHub issue reference |
| `maxUrls` | number \| null | `null` | Maximum URLs to process |
| `includeLinkedAssets` | boolean | `true` | Whether to fetch linked CSS/JS from HTML pages |
| `sameOriginOnly` | boolean | `true` | Restrict URL mode to same-origin assets |
| `audienceWeights` | object \| null | `null` | Browser family weight map |
| `unsupportedThresholdPercent` | number | `10` | Modern feature unsupported % above which severity is `high` |
| `removableThresholdPercent` | number | `5` | Polyfill unsupported % below which it is marked `possibly-obsolete-polyfill` |
| `format` | `"markdown"` \| `"json"` \| `"github"` | `"markdown"` | Default output format |
| `ci` | boolean | `false` | Emit GitHub Actions annotations in Markdown format |

CLI flags override all config-file values.

---

## 5. Detection Rules

Rules are defined in `src/rules.js` as an array of objects. Each rule has:

- **`id`** — unique snake-case identifier.
- **`title`** — short human-readable description.
- **`type`** — one of `modern-feature`, `polyfill`, `legacy-pattern`.
- **`sourceType`** — which file type to scan: `html`, `css`, or `js`.
- **`caniuseFeature`** — Can I Use feature key for support lookup.
- **`mdnPath`** — MDN Browser Compatibility Data path for deprecation metadata.
- **`matchRegex`** — regex used to detect the pattern.
- **`detect(text)`** — boolean function applied to full source text.
- **`whyItMatters`** — plain-English explanation of why the finding is significant.
- **`recommendation`** — actionable remediation guidance.

### 5.1 Modern-Feature Rules

These rules fire when the codebase uses a feature that may not be supported broadly enough for the configured browser targets.

| Rule ID | Source Type | Pattern Detected | Can I Use Feature |
|---|---|---|---|
| `html-dialog` | HTML | `<dialog>` element | `dialog` |
| `html-details-summary` | HTML | `<details>`/`<summary>` elements | `details` |
| `html-popover-api` | HTML | `popover` attribute | `mdn-api_htmlelement_popover` |
| `css-has-selector` | CSS | `:has()` pseudo-class | `css-has` |
| `css-container-queries` | CSS | `@container` / `container-type:` | `css-container-queries` |
| `css-subgrid` | CSS | `subgrid` keyword | `css-subgrid` |
| `js-optional-chaining` | JS | `?.` operator | `mdn-javascript_operators_optional_chaining` |
| `js-nullish-coalescing` | JS | `??` operator | `mdn-javascript_operators_nullish_coalescing` |

#### Rule details

**`html-dialog`**
- Why it matters: Native dialogs reduce JavaScript complexity and improve accessibility semantics, but support may be insufficient for older targets.
- Recommendation: Provide a fallback or load a lightweight polyfill conditionally.

**`html-details-summary`**
- Why it matters: The native disclosure widget can replace JavaScript-driven accordions, reducing JS bytes.
- Recommendation: Prefer the native element with CSS customisation; add a graceful fallback for unsupported browsers.

**`html-popover-api`**
- Why it matters: The Popover API replaces custom JS overlay logic, but older browsers need fallback behaviour.
- Recommendation: Use for progressive enhancement; maintain a robust non-popover interaction path.

**`css-has-selector`**
- Why it matters: `:has()` can replace JavaScript-driven parent-state logic, but support lags in older browsers.
- Recommendation: Keep critical functionality resilient when `:has()` is unavailable.

**`css-container-queries`**
- Why it matters: Container queries reduce JS-driven responsive logic; support is still maturing in some segments.
- Recommendation: Ensure critical layouts remain usable when unsupported.

**`css-subgrid`**
- Why it matters: Subgrid improves maintainable layout architecture but support is uneven.
- Recommendation: Provide resilient grid fallbacks for critical page structure.

**`js-optional-chaining`**
- Why it matters: Improves readability and safety; very old browsers require transpilation.
- Recommendation: Transpile this syntax if older browsers are in scope.

**`js-nullish-coalescing`**
- Why it matters: Simplifies defaults without falsy-value bugs; legacy browsers need transpilation.
- Recommendation: Transpile for older support, or gate to modern bundles only.

---

### 5.2 Polyfill Rules

These rules fire when a polyfill is detected that may no longer be necessary for your configured browser targets.

| Rule ID | Source Type | Pattern Detected | Can I Use Feature |
|---|---|---|---|
| `polyfill-io` | HTML | `polyfill.io` URL | `promises` |
| `intersection-observer-polyfill` | JS | `intersection-observer` / `intersectionobserver-polyfill` | `intersectionobserver` |
| `resize-observer-polyfill` | JS | `resize-observer-polyfill` / `@juggle/resize-observer` | `resizeobserver` |
| `webcomponents-polyfill` | JS | `webcomponentsjs` / `@webcomponents/webcomponentsjs` | `custom-elementsv1` |
| `core-js-import` | JS | `core-js` / `babel-polyfill` / `es5-shim` / `es6-shim` | `es6` |
| `regenerator-runtime` | JS | `regenerator-runtime` | `async-functions` |

#### Rule details

**`polyfill-io`**
- Why it matters: Broad polyfill payloads can hurt performance and may include features no longer needed.
- Recommendation: Audit which features are still required and trim unused polyfills.

**`intersection-observer-polyfill`**
- Why it matters: `IntersectionObserver` is now broadly supported; blanket polyfilling is unnecessary.
- Recommendation: Conditionally load only for browsers that still lack support.

**`resize-observer-polyfill`**
- Why it matters: `ResizeObserver` is widely supported; unconditional polyfills add avoidable JS overhead.
- Recommendation: Move to feature-detected conditional loading.

**`webcomponents-polyfill`**
- Why it matters: Web Components polyfills are expensive and may no longer be required for modern targets.
- Recommendation: Review support needs; ship only to unsupported browsers.

**`core-js-import`**
- Why it matters: Global polyfill bundles increase JS size and execution cost.
- Recommendation: Prefer targeted polyfills and differential serving.

**`regenerator-runtime`**
- Why it matters: Async transpilation runtime may no longer be required for modern baselines.
- Recommendation: Re-check browser targets; disable if async support is now sufficient.

---

### 5.3 Legacy-Pattern Rules

These rules fire when the codebase uses patterns that have well-established modern native alternatives.

| Rule ID | Source Type | Pattern Detected | Notes |
|---|---|---|---|
| `jquery-legacy` | JS | `$(` / `jQuery(` | Broad DOM API now covers most jQuery use cases |
| `document-write` | JS | `document.write(` | Parser-blocking; security and performance risk |
| `sync-xhr` | JS | `.open(…, false)` | Synchronous XHR blocks the main thread |

#### Rule details

**`jquery-legacy`**
- Why it matters: Many DOM tasks historically handled by jQuery are now covered by standard APIs.
- Recommendation: Evaluate targeted vanilla replacements to reduce dependency and improve startup performance.

**`document-write`**
- Why it matters: Blocks parsing, hurts performance, and creates maintainability and security risk.
- Recommendation: Replace with DOM APIs or server-side rendering patterns.

**`sync-xhr`**
- Why it matters: Blocks the main thread and degrades responsiveness and accessibility.
- Recommendation: Move to async `fetch` / `XMLHttpRequest` patterns.

---

## 6. Browser-Support Evaluation

Defined in `src/support.js`. All support decisions are scoped to your configured `targets` Browserslist query.

### Primary method — caniuse-api

1. `browserslist(targetQuery)` resolves the query to a concrete list of browser strings (e.g. `chrome 131`, `safari 18`).
2. `caniuse-api` is queried for the rule's `caniuseFeature` key.
3. Each resolved browser is checked for support status.
4. Returns `supportedTargets`, `unsupportedTargets`, and raw `unsupportedPercent`.

### Fallback method — MDN Browser Compatibility Data (BCD)

When a Can I Use feature key is unavailable, the fallback uses `@mdn/browser-compat-data`:

1. Browserslist names are translated to BCD keys via an internal mapping table:

   | Browserslist | BCD key |
   |---|---|
   | `and_chr` | `chrome_android` |
   | `and_ff` | `firefox_android` |
   | `android` | `webview_android` |
   | `chrome` | `chrome` |
   | `edge` | `edge` |
   | `firefox` | `firefox` |
   | `ios_saf` | `safari_ios` |
   | `op_mob` | `opera_android` |
   | `opera` | `opera` |
   | `safari` | `safari` |
   | `samsung` | `samsunginternet_android` |

2. Version constraints from BCD are evaluated against the target browser version.
3. Returns the same structure as the primary method, with `source: "mdn-bcd"`.

### MDN metadata

`getMdnMetadata(mdnPath)` enriches findings with:

- `deprecated` — whether the feature is officially deprecated.
- `experimental` — whether the feature is experimental / behind a flag.
- `standardTrack` — whether the feature is on a standards track.
- `mdnUrl` — link to MDN documentation page.
- `specUrl` — link to the relevant specification.

### Weighted audience scoring

When `audienceWeights` is configured, the tool reports a second score:

- Keys are browser family names (`chrome`, `safari`, `firefox`, `edge`, etc.).
- Values are numeric weights normalised to sum to 1.0.
- `weightedUnsupportedPercent` reflects your *actual* user distribution rather than the equal-weight share across all resolved target strings.
- Both raw and weighted percentages appear in Markdown and JSON output.

---

## 7. CSS Quality Analysis

Defined in `src/css-quality.js`. Runs automatically for every CSS file or `<style>` block encountered. Powered by two Project Wallace libraries:

### 7.1 Code Quality Scores — `@projectwallace/css-code-quality`

Three scores in the range 0–100:

| Score | Threshold | Icon |
|---|---|---|
| ≥ 90 | Good | ✅ |
| ≥ 70 | Acceptable | ⚠️ |
| < 70 | Needs work | ❌ |

- **Performance** — flags patterns that cause inefficient rendering (overly complex selectors, excessive universal selectors, etc.).
- **Maintainability** — evaluates code clarity and organisation (duplicate properties, use of `!important`, unnamed magic values, etc.).
- **Complexity** — measures structural complexity of the stylesheet.

A **violations list** accompanies the scores, identifying each rule ID and its impact on the score.

### 7.2 Complexity Metrics — `@projectwallace/css-analyzer`

| Metric | Description |
|---|---|
| Source lines of code | Non-comment, non-blank lines |
| Total rules | Number of CSS rule blocks |
| Total selectors | All selectors across all rules |
| Total declarations | All CSS property declarations |
| `!important` count | Number of `!important` overrides |
| Max selector specificity | Highest specificity value found (a, b, c format) |
| Overall complexity | Composite complexity score |

### 7.3 Design Tokens

Extracted from the `css-analyzer` output:

| Token type | What is captured |
|---|---|
| CSS custom properties | Total count, unique count, list of unique variable names |
| Colors | Total count, unique values (hex, rgb, hsl, named, etc.) |
| Font families | Total count, unique family names |
| Font sizes | Total count, unique values (px, rem, em, etc.) |
| Z-index values | Total count, unique numeric values |

### 7.4 Implementation details

- Modules are **lazy-loaded** on first CSS file encountered (ESM dynamic import) to keep startup time low when no CSS is scanned.
- Analysis runs synchronously per file; results feed both Markdown and JSON output.

---

## 8. Severity Classification

Defined in `src/scanner.js` → `classifyFinding()`. Severity depends on rule type:

### Modern-feature rules

| Condition | Severity | Kind |
|---|---|---|
| Unsupported share > `unsupportedThresholdPercent` (default 10%) | `high` | `too-new` |
| Unsupported share ≤ threshold | `low` | `acceptable` |
| MDN marks feature as `deprecated` | `high` | `deprecated` |

### Polyfill rules

| Condition | Severity | Kind |
|---|---|---|
| Unsupported share < `removableThresholdPercent` (default 5%) | `medium` | `possibly-obsolete-polyfill` |
| Unsupported share ≥ threshold | `low` | `still-needed` |

### Legacy-pattern rules

| Condition | Severity | Kind |
|---|---|---|
| MDN marks feature as `deprecated` | `high` | `deprecated` |
| Otherwise | `low` | `legacy` |

---

## 9. Output Formats

### 9.1 Markdown (default)

Structured Markdown report suitable for human review, GitHub PR comments, or artifact upload.

Sections:
- **Header** — scan timestamp, target query, number of files scanned.
- **Summary stats** — findings count, source errors count.
- **Source errors** — list of files/URLs that could not be loaded.
- **Findings** — one section per finding sorted by severity (high → medium → low) then filename:
  - Rule title, type, severity kind
  - File path and line number
  - Descriptive message
  - Why it matters
  - Recommendation
  - Can I Use feature link
  - Unsupported target share (raw %)
  - Weighted unsupported share (if `audienceWeights` configured)
  - List of unsupported browser targets
  - MDN documentation link (if available)
- **CSS Analysis** — per-file code quality scores, violations, complexity metrics, and design tokens.

### 9.2 JSON

Full machine-readable output:

```json
{
  "config": { … },
  "report": {
    "scannedFiles": [ … ],
    "sourceErrors": [ … ],
    "findings": [ … ],
    "cssAnalysis": [ … ]
  }
}
```

Each finding object includes all support data, MDN metadata, severity, and source location. Useful for downstream processing, dashboards, or custom formatters.

### 9.3 GitHub Annotations (`--format github` or `--ci`)

One annotation per finding in GitHub Actions log syntax:

```
::error file=path/to/file,line=N,title=Rule Title::Severity message
::warning file=path/to/file,line=N,title=Rule Title::Severity message
::notice file=path/to/file,line=N,title=Rule Title::Severity message
```

Severity mapping:

| Severity | Annotation level |
|---|---|
| `high` | `::error` |
| `medium` | `::warning` |
| `low` | `::notice` |

In `github` format mode, annotations are emitted first, followed by the full Markdown report. In `markdown` format with `--ci`, annotations are appended at the end of the Markdown.

---

## 10. GitHub Actions Integration

Defined in `.github/workflows/site-review.yml`.

### Triggers

| Event | Condition |
|---|---|
| `pull_request` | Any PR — scans repo files and uploads Markdown artifact |
| `issues` — `opened`, `reopened` | Issue title starts with `SCAN:` |
| `schedule` | Daily at 00:00 UTC — processes open `SCAN:` issues |
| `workflow_dispatch` | Manual trigger with optional issue reference |

### PR scan job

1. Checks out the PR branch.
2. Installs dependencies with `npm ci`.
3. Runs `npm run scan:ci` (GitHub annotation format).
4. Uploads the Markdown report as a workflow artifact.
5. Annotations appear in the PR "Checks" tab.

### SCAN: issue job

1. Reads URLs from the issue body (or discovers them via sitemap/crawl).
2. Runs the scanner against those URLs.
3. Posts the full report as an issue comment.
4. Publishes the report to GitHub Pages (`docs/reports/`).
5. Updates the reports index page.
6. Closes the issue automatically after reporting.
7. If reopened, re-runs and closes again.

### Node.js version

Workflow uses Node.js 22 (`node: 22`).

---

## 11. GitHub Issue Automation

Defined in `src/github-issues.js`.

### Issue reference parsing

Accepts:
- Full GitHub issue URL: `https://github.com/owner/repo/issues/123`
- Short reference: `owner/repo#123`

### URL discovery pipeline

1. **Explicit URLs** — if the issue body already contains `http://` or `https://` URLs that are not images/PDFs/archives, those are used directly.
2. **Sitemap** — if a root domain URL is present, attempts `GET /sitemap.xml`. Handles both plain sitemaps and sitemap index files (recursively fetches child sitemaps).
3. **BFS crawl** — if no sitemap, crawls same-origin HTML links breadth-first up to `maxUrls` pages.

### Issue body update

After discovery, the issue body is updated with the discovered URL list and a timestamp (`<!-- open-site-review scan: YYYY-MM-DDTHH:mm:ssZ -->`), making results reproducible.

### Authentication

- `GITHUB_TOKEN` or `GH_TOKEN` environment variable is used for issue reads and writes.
- Without a token, public issue bodies can still be read (subject to rate limits).

---

## 12. GitHub Pages Publishing

Reports are published to the `docs/` directory on the `main` branch, served via GitHub Pages from the `/docs` folder.

- **Reports directory**: `docs/reports/`
- **Index generation**: `scripts/update-pages-index.js` regenerates `docs/reports.html` listing all published reports.
- **Home page**: `docs/index.html` links to the reports listing.
- **Static marker**: `.nojekyll` prevents Jekyll from processing the docs folder.
- **Naming convention**: Report files are named by scan timestamp.

---

## 13. Possible Future Enhancements

The following enhancements would extend `open-site-review` from a browser-compatibility scanner into a comprehensive **best-practices and code-health scanner**. The focus is on practical, actionable signals — not accessibility or sustainability (those are separate concerns), but the quality, security, and maintainability of the front-end code itself.

---

### 13.1 Third-Party JavaScript Detection and Inventory

**What it would do**

Scan HTML pages and JavaScript files for references to external scripts and build a full inventory of all third-party JavaScript loaded. This includes:

- Inline `<script src="...">` tags pointing to CDNs (e.g. Google Fonts, Cloudflare CDN, jsDelivr, unpkg, cdnjs).
- Dynamic `document.createElement('script')` or `import()` patterns that load remote code.
- Known tracker domains (Google Analytics, Facebook Pixel, Hotjar, Intercom, Segment, etc.).
- A/B testing tools, chat widgets, customer data platforms.

**Why it matters**

Third-party JavaScript is the single largest uncontrolled variable in front-end performance and security. It runs in the first-party origin, can exfiltrate user data, slow page load, and introduce vulnerabilities entirely outside the developer's control. The problem is analogous to what WhatsApp and other messaging platforms have studied in terms of information leakage through third-party integrations — even well-meaning analytics scripts can transmit user behaviour, form data, or session tokens to external parties.

**Signals to surface**

- Number of unique third-party domains loading JavaScript.
- Total estimated third-party script weight.
- Whether any of the detected third parties are known data-collection services.
- Whether scripts are loaded with `async`/`defer` (good) or blocking (bad).
- Whether a `Content-Security-Policy` header restricts which external scripts are allowed.

**Implementation approach**

- Maintain a curated lookup table of CDN and tracker hostnames.
- Parse `<script src>` and dynamic import patterns (regex at first; AST for greater accuracy later).
- Optionally query the [WhoTracks.me](https://whotracks.me/) or [Disconnect tracker list](https://github.com/nicehash/disconnect) datasets for category classification.

---

### 13.2 Outdated and Vulnerable Library Detection

**What it would do**

Detect known JavaScript libraries loaded from CDNs or bundled locally, check their version, and flag those that are:

- Outdated (a newer version is available).
- Known to have security vulnerabilities (CVE, GitHub Advisory, npm Advisory).

**Why it matters**

Outdated libraries are one of the most common entry points for supply-chain attacks and known exploits. A site still loading jQuery 1.x, Bootstrap 3, or an old version of moment.js is exposed to publicly documented attack vectors. This is the front-end equivalent of OS patching.

**Signals to surface**

- Library name and detected version (from CDN URL, inline comment, or bundle signature).
- Latest stable release.
- Whether the detected version has known CVEs (Common Vulnerabilities and Exposures).
- CVSS severity score of any known vulnerabilities.
- Link to the relevant advisory.

**Implementation approach**

- Parse CDN URLs (`cdnjs.cloudflare.com/ajax/libs/<name>/<version>/`, `unpkg.com/<name>@<version>/`, `cdn.jsdelivr.net/npm/<name>@<version>/`) to extract library name and version.
- Use **[Retire.js](https://retirejs.github.io/retire.js/)** — an open-source vulnerability database for JavaScript libraries — as the primary lookup source. Retire.js maintains regex-based version fingerprints and maps them to CVEs.
- Cross-reference with the **[npm Advisory Database](https://github.com/advisories?query=ecosystem%3Anpm)** via the GitHub Advisory API.
- For bundled (non-CDN) code, attempt library fingerprinting via comment patterns (e.g. `/*! jQuery v3.5.1 */`).

---

### 13.3 Content Security Policy (CSP) Analysis

**What it would do**

Fetch and evaluate the `Content-Security-Policy` response header (or meta tag equivalent) from scanned URLs, then report:

- Whether a CSP is present.
- Whether `unsafe-inline` or `unsafe-eval` are permitted in `script-src` (high risk).
- Whether `default-src` is configured as a safe fallback.
- Whether third-party domains listed in §13.1 are explicitly allowed or blocked.
- Whether `upgrade-insecure-requests` is present.
- Whether `frame-ancestors` is set to prevent clickjacking.
- Whether the `report-uri` / `report-to` directive is configured for violation monitoring.

**Why it matters**

A missing or permissive CSP is the primary defence bypass for Cross-Site Scripting (XSS) attacks. `unsafe-inline` negates the protection afforded by the policy. This aligns directly with information-leakage concerns: a weak CSP allows injected scripts to exfiltrate session data, cookies, or form values.

---

### 13.4 HTTP Security Header Analysis

**What it would do**

In URL scan mode, inspect HTTP response headers for best-practice security headers and score each page:

| Header | What to check |
|---|---|
| `Strict-Transport-Security` | Present, `max-age` ≥ 1 year, `includeSubDomains` |
| `X-Content-Type-Options` | `nosniff` present |
| `X-Frame-Options` or CSP `frame-ancestors` | Clickjacking prevention |
| `Referrer-Policy` | Set to `no-referrer` or `same-origin` |
| `Permissions-Policy` | Camera, microphone, geolocation, payment locked down |
| `Cross-Origin-Resource-Policy` | Set to `same-origin` or `same-site` |
| `Cross-Origin-Opener-Policy` | Set to `same-origin` |
| `Cross-Origin-Embedder-Policy` | Set to `require-corp` (for SharedArrayBuffer/performance) |

**Why it matters**

These headers are low-effort, high-impact mitigations for entire classes of attacks (MIME confusion, clickjacking, cross-origin data leaks). Their absence is a clear signal of security hygiene gaps.

---

### 13.5 Mixed Content and Protocol Security

**What it would do**

- Detect `http://` resource references (images, scripts, styles) loaded inside `https://` pages.
- Detect inline JavaScript event handlers (`onclick=`, `onload=`, etc.) that bypass CSP.
- Detect `eval()`, `new Function()`, `setTimeout(string)`, and `setInterval(string)` calls that execute dynamic strings.

**Why it matters**

Mixed content downgrades HTTPS security guarantees. Inline handlers and `eval`-like patterns are both security risks and common CSP blockers. `eval()` in particular is the canonical entry point for code injection.

---

### 13.6 Exposed Sensitive Data Patterns

**What it would do**

Scan JavaScript and HTML source code for patterns that suggest sensitive data may be accidentally exposed in client-side code:

- API keys and tokens embedded in JS files (regex patterns for common key formats: AWS, Stripe, Twilio, SendGrid, GitHub PATs, etc.).
- Private credentials or passwords in comments or config objects.
- Internal IP addresses or private hostnames in client-side code.
- Personally Identifiable Information (PII) patterns (e.g. SSN, credit card number formats in test/mock data).
- JWT tokens hard-coded in source.
- `localStorage` or `sessionStorage` usage storing sensitive-looking keys.

**Why it matters**

This is directly analogous to the type of information-leakage analysis done in security research on web applications and messaging clients (such as studies of what WhatsApp Web and similar SPAs inadvertently expose in their JavaScript bundles). Exposed API keys lead to immediate account compromise. Hard-coded credentials in production code are a critical vulnerability regardless of the application type.

**Implementation approach**

- Maintain a set of regexes covering common credential formats (similar to [gitleaks](https://github.com/gitleaks/gitleaks) patterns or [truffleHog](https://github.com/trufflesecurity/trufflehog)).
- Flag with high severity and redact the matched value in output to avoid leaking the key in the report itself.
- Distinguish between "likely real" patterns (long entropy strings matching known formats) and "test data" patterns (short or obviously fake values) using entropy heuristics.

---

### 13.7 Subresource Integrity (SRI) Enforcement

**What it would do**

For every `<script src>` and `<link rel="stylesheet">` tag loading a resource from an external domain, check whether a valid `integrity="sha256-..."` attribute is present.

**Why it matters**

Without SRI, a CDN compromise or DNS hijack can replace a script with malicious code and no browser will detect the substitution. SRI is a one-line defence against this category of supply-chain attack.

**Signals to surface**

- External scripts without `integrity` attribute.
- External stylesheets without `integrity` attribute.
- Whether the `crossorigin` attribute is also set (required for SRI to work).

---

### 13.8 Cookie and Storage Practice Analysis

**What it would do**

- Detect `document.cookie` reads and writes in JavaScript.
- Flag cookies set without `HttpOnly`, `Secure`, or `SameSite` attributes (via HTTP response header inspection in URL mode).
- Detect `localStorage.setItem` / `sessionStorage.setItem` calls storing data under sensitive-looking key names.
- Detect `IndexedDB` usage.

**Why it matters**

Cookies without `HttpOnly` are readable by XSS. Cookies without `Secure` are transmitted over HTTP. Cookies without `SameSite` are vulnerable to CSRF. Sensitive data in `localStorage` persists indefinitely and is accessible to all same-origin scripts including injected third-party code.

---

### 13.9 JavaScript Bundle Size and Loading Pattern Analysis

**What it would do**

In URL scan mode:

- Record the size (in bytes) of every JS and CSS asset fetched.
- Calculate the total first-party and third-party script weight.
- Detect render-blocking scripts (synchronous `<script>` tags in `<head>` without `async` or `defer`).
- Detect large inline script blocks (above a configurable threshold, e.g. > 50 KB).
- Detect unused `<link rel="preload">` tags that do not have a corresponding use below the fold.

**Why it matters**

Large, render-blocking script payloads are one of the primary causes of poor Core Web Vitals scores. Heavy third-party bundles in particular (§13.1) frequently account for 30–70% of a page's JavaScript weight with no benefit to the user.

---

### 13.10 Deprecated and Removed Web APIs

**What it would do**

Extend the existing rule set with additional detectors for Web APIs that are deprecated or have been removed from browsers:

- `document.domain` assignment (deprecated).
- `KeyboardEvent.keyCode` / `which` (deprecated in favour of `key`).
- `navigator.platform` (deprecated).
- `window.event` (deprecated).
- `XMLHttpRequest` in service workers (removed).
- `webkitURL` / `webkitRequestAnimationFrame` vendor prefixes.
- Legacy CSS vendor prefixes (`-webkit-`, `-moz-`, `-ms-`) no longer required for targeted browsers.
- `@charset` rules in CSS files loaded via `<link>` (ineffective and often mistaken).

**Implementation approach**

Expand `src/rules.js` with additional `legacy-pattern` or `modern-feature` entries. MDN BCD `deprecated: true` flag can be used to automate discovery of further candidates.

---

### 13.11 AST-Level JavaScript Analysis

**What it would do**

Replace regex-based detection with proper Abstract Syntax Tree (AST) parsing using a library such as [acorn](https://github.com/acornjs/acorn), [meriyah](https://github.com/meriyah/meriyah), or [oxc](https://oxc.rs/) (Rust-based, very fast):

- **True positive rate**: Eliminate false positives from regex matches inside comments or string literals.
- **Scope-aware detection**: Identify when a polyfill is conditionally loaded (already correct) vs. unconditionally loaded (wasteful).
- **Call graph analysis**: Detect `eval()` only when actually called (not when the string `"eval"` appears in a comment).
- **Import/require analysis**: Map `require('core-js')` and `import 'core-js'` to known package names.

---

### 13.12 `package.json` and Dependency Audit Integration

**What it would do**

In file-scan mode, detect `package.json` files and:

- Run `npm audit --json` (or parse the lock file offline) to surface vulnerable dependencies.
- Flag packages that have been deprecated on npm.
- Flag packages with no recent activity (last publish > 2 years ago) as potential abandonment risk.
- Flag packages known to have been involved in supply-chain incidents (e.g. malicious publishes).
- Report the total number of direct and transitive production dependencies as a complexity signal.

**Why it matters**

Supply-chain compromise via npm dependencies is one of the fastest-growing attack vectors. Most front-end projects have hundreds of transitive dependencies, and developers rarely audit them. Integrating this into the scanner gives a unified view of both runtime code quality and dependency health.

---

### 13.13 Robots.txt and Security.txt Presence

**What it would do**

In URL scan mode, check for the presence and validity of:

- **`/robots.txt`** — ensures the site has a crawl policy.
- **`/security.txt`** (or `/.well-known/security.txt`) — the standard file for responsible disclosure contact information, as defined by [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116).

**Why it matters**

`security.txt` is increasingly expected by security researchers and bug bounty hunters. Its absence signals that there is no clear vulnerability disclosure channel, which can delay responsible disclosure and increase risk.

---

### 13.14 Source Map Exposure Detection

**What it would do**

In URL scan mode, check whether production JavaScript or CSS files reference source map files (`//# sourceMappingURL=...`) that are publicly accessible. Attempt a `HEAD` or `GET` request to verify if the `.map` file is actually downloadable.

**Why it matters**

Exposed source maps reveal the original pre-minified/pre-compiled source code of the application to anyone with browser DevTools. This allows attackers to understand application logic, find hidden endpoints, read comments containing credentials or architectural notes, and reverse-engineer proprietary code.

---

### 13.15 Iframe and Embedding Security

**What it would do**

- Detect `<iframe src>` tags and classify each embedded origin as first-party or third-party.
- Check for missing `sandbox` attribute on iframes.
- Detect `<iframe allow="...">` permissions that grant overly broad capabilities (e.g. `allow="camera; microphone; geolocation"` with no restriction).
- Detect `<object>`, `<embed>`, and `<applet>` tags (legacy embedding mechanisms with poor sandboxing).

**Why it matters**

Unsandboxed iframes and broad feature permissions are a common vector for data exfiltration. Embedded third-party iframes (payment widgets, social media embeds, video players) can access the user's browser APIs and potentially leak data back to their origin.

---

### 13.16 Configurable Rule Packs

**What it would do**

Introduce the concept of named rule packs that can be enabled or disabled in config:

```json
{
  "rulePacks": ["browser-compat", "security", "third-party", "performance", "best-practices"]
}
```

- `browser-compat` — current rules (modern features, polyfills, legacy patterns).
- `security` — CSP, security headers, SRI, exposed credentials, cookie flags (§13.3–13.8, 13.7–13.8).
- `third-party` — third-party JS inventory, SRI, tracker detection (§13.1, 13.7).
- `performance` — bundle size, render-blocking scripts, preload usage (§13.9).
- `best-practices` — deprecated APIs, `package.json` audit, source map exposure (§13.10, 13.12, 13.14).

This would allow teams to opt in to only the checks relevant to their context without noise from checks they cannot act on.

---

*Last updated: 2026-03-21. For contribution guidance see `AGENTS.md`.*
