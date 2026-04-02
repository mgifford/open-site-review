"use strict";

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const {
  sortFindings,
  toGithubAnnotations,
  toMarkdown,
  formatQualityScore,
  annotationLevel
} = require("../src/reporters.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeFinding(overrides = {}) {
  return {
    id: "html-dialog",
    title: "Uses <dialog> element",
    file: "test.html",
    line: 5,
    severity: "high",
    kind: "too-new",
    message: "Feature may be too new for target browsers (50.0% unsupported).",
    whyItMatters: "Native dialogs can reduce JS.",
    recommendation: "Provide a fallback.",
    caniuseFeature: "dialog",
    unsupportedPercent: 50.0,
    weightedUnsupportedPercent: null,
    unsupportedTargets: ["ie 11"],
    supportError: null,
    supportSource: "caniuse",
    mdn: { found: true, deprecated: false, mdnUrl: "https://developer.mozilla.org/docs/Web/HTML/Element/dialog" },
    ...overrides
  };
}

const BASE_CONFIG = {
  targets: "defaults, not ie <= 11",
  unsupportedThresholdPercent: 10,
  removableThresholdPercent: 5,
  scanMode: "files",
  audienceWeights: null
};

// ---------------------------------------------------------------------------
// annotationLevel
// ---------------------------------------------------------------------------
describe("annotationLevel", () => {
  test("maps 'high' to 'error'", () => {
    assert.equal(annotationLevel("high"), "error");
  });

  test("maps 'medium' to 'warning'", () => {
    assert.equal(annotationLevel("medium"), "warning");
  });

  test("maps 'low' to 'notice'", () => {
    assert.equal(annotationLevel("low"), "notice");
  });

  test("maps unknown severity to 'notice'", () => {
    assert.equal(annotationLevel("unknown"), "notice");
  });
});

// ---------------------------------------------------------------------------
// formatQualityScore
// ---------------------------------------------------------------------------
describe("formatQualityScore", () => {
  test("appends ✅ for scores >= 90", () => {
    assert.ok(formatQualityScore(95).includes("✅"));
    assert.ok(formatQualityScore(90).includes("✅"));
  });

  test("appends ⚠️ for scores 70–89", () => {
    assert.ok(formatQualityScore(89).includes("⚠️"));
    assert.ok(formatQualityScore(70).includes("⚠️"));
  });

  test("appends ❌ for scores below 70", () => {
    assert.ok(formatQualityScore(69).includes("❌"));
    assert.ok(formatQualityScore(0).includes("❌"));
  });

  test("includes the score and /100 in the output", () => {
    const result = formatQualityScore(85);
    assert.ok(result.includes("85"));
    assert.ok(result.includes("/100"));
  });

  test("returns 'N/A' for non-numeric input", () => {
    assert.equal(formatQualityScore(null), "N/A");
    assert.equal(formatQualityScore(undefined), "N/A");
    assert.equal(formatQualityScore("string"), "N/A");
  });
});

// ---------------------------------------------------------------------------
// sortFindings
// ---------------------------------------------------------------------------
describe("sortFindings", () => {
  test("sorts high severity before medium and low", () => {
    const findings = [
      makeFinding({ severity: "low", file: "c.html" }),
      makeFinding({ severity: "high", file: "a.html" }),
      makeFinding({ severity: "medium", file: "b.html" })
    ];
    const sorted = sortFindings(findings);
    assert.equal(sorted[0].severity, "high");
    assert.equal(sorted[1].severity, "medium");
    assert.equal(sorted[2].severity, "low");
  });

  test("sorts findings with the same severity alphabetically by file", () => {
    const findings = [
      makeFinding({ severity: "high", file: "z.html" }),
      makeFinding({ severity: "high", file: "a.html" }),
      makeFinding({ severity: "high", file: "m.html" })
    ];
    const sorted = sortFindings(findings);
    assert.equal(sorted[0].file, "a.html");
    assert.equal(sorted[1].file, "m.html");
    assert.equal(sorted[2].file, "z.html");
  });

  test("does not mutate the original array", () => {
    const findings = [
      makeFinding({ severity: "low", file: "z.html" }),
      makeFinding({ severity: "high", file: "a.html" })
    ];
    const original = [...findings];
    sortFindings(findings);
    assert.deepEqual(findings, original);
  });

  test("returns an empty array for empty input", () => {
    assert.deepEqual(sortFindings([]), []);
  });

  test("handles a single finding", () => {
    const f = makeFinding();
    const sorted = sortFindings([f]);
    assert.equal(sorted.length, 1);
    assert.equal(sorted[0].id, f.id);
  });
});

// ---------------------------------------------------------------------------
// toGithubAnnotations
// ---------------------------------------------------------------------------
describe("toGithubAnnotations", () => {
  test("returns empty string for no findings", () => {
    assert.equal(toGithubAnnotations([]), "");
  });

  test("formats a high-severity finding as an error annotation", () => {
    const finding = makeFinding({ severity: "high", line: 5, file: "src/page.html" });
    const output = toGithubAnnotations([finding]);
    assert.ok(output.startsWith("::error "));
    assert.ok(output.includes("file=src/page.html"));
    assert.ok(output.includes("line=5"));
  });

  test("formats a medium-severity finding as a warning annotation", () => {
    const finding = makeFinding({ severity: "medium", file: "app.js" });
    const output = toGithubAnnotations([finding]);
    assert.ok(output.startsWith("::warning "));
  });

  test("formats a low-severity finding as a notice annotation", () => {
    const finding = makeFinding({ severity: "low", file: "styles.css" });
    const output = toGithubAnnotations([finding]);
    assert.ok(output.startsWith("::notice "));
  });

  test("omits the line part when finding.line is null", () => {
    const finding = makeFinding({ line: null });
    const output = toGithubAnnotations([finding]);
    assert.ok(!output.includes("line="));
  });

  test("escapes newlines in the message", () => {
    const finding = makeFinding({ message: "First line\nSecond line" });
    const output = toGithubAnnotations([finding]);
    assert.ok(!output.includes("\n") || output.split("\n").length === 1);
  });

  test("produces one line per finding separated by newlines", () => {
    const findings = [makeFinding({ file: "a.html" }), makeFinding({ file: "b.html" })];
    const lines = toGithubAnnotations(findings).split("\n");
    assert.equal(lines.length, 2);
  });
});

// ---------------------------------------------------------------------------
// toMarkdown
// ---------------------------------------------------------------------------
describe("toMarkdown", () => {
  test("contains the report header", () => {
    const report = { scannedFiles: 0, sourceErrors: [], findings: [], cssAnalysis: [] };
    const output = toMarkdown(report, BASE_CONFIG);
    assert.ok(output.includes("# Open Site Review Report"));
  });

  test("includes the target browsers in the header", () => {
    const report = { scannedFiles: 2, sourceErrors: [], findings: [], cssAnalysis: [] };
    const output = toMarkdown(report, BASE_CONFIG);
    assert.ok(output.includes(BASE_CONFIG.targets));
  });

  test("reports 'No findings' when findings is empty", () => {
    const report = { scannedFiles: 1, sourceErrors: [], findings: [], cssAnalysis: [] };
    const output = toMarkdown(report, BASE_CONFIG);
    assert.ok(output.includes("No findings detected"));
  });

  test("includes finding title and severity for each finding", () => {
    const findings = [makeFinding({ severity: "high", title: "Uses <dialog> element" })];
    const report = { scannedFiles: 1, sourceErrors: [], findings, cssAnalysis: [] };
    const output = toMarkdown(report, BASE_CONFIG);
    assert.ok(output.includes("[HIGH]"));
    assert.ok(output.includes("Uses <dialog> element"));
  });

  test("includes finding file and line number", () => {
    const findings = [makeFinding({ file: "src/index.html", line: 12 })];
    const report = { scannedFiles: 1, sourceErrors: [], findings, cssAnalysis: [] };
    const output = toMarkdown(report, BASE_CONFIG);
    assert.ok(output.includes("src/index.html:12"));
  });

  test("includes MDN URL when present", () => {
    const findings = [makeFinding({
      mdn: { found: true, mdnUrl: "https://developer.mozilla.org/docs/dialog" }
    })];
    const report = { scannedFiles: 1, sourceErrors: [], findings, cssAnalysis: [] };
    const output = toMarkdown(report, BASE_CONFIG);
    assert.ok(output.includes("https://developer.mozilla.org/docs/dialog"));
  });

  test("includes source fetch errors section when errors exist", () => {
    const report = {
      scannedFiles: 0,
      sourceErrors: [{ location: "https://example.com", message: "HTTP 404" }],
      findings: [],
      cssAnalysis: []
    };
    const output = toMarkdown(report, BASE_CONFIG);
    assert.ok(output.includes("Source Fetch Errors"));
    assert.ok(output.includes("HTTP 404"));
  });

  test("shows 'audience weighting: enabled' when audienceWeights are configured", () => {
    const config = { ...BASE_CONFIG, audienceWeights: { chrome: 1 } };
    const report = { scannedFiles: 1, sourceErrors: [], findings: [], cssAnalysis: [] };
    const output = toMarkdown(report, config);
    assert.ok(output.toLowerCase().includes("audience weighting: enabled"));
  });

  test("includes GitHub Annotations section in CI mode when there are findings", () => {
    const findings = [makeFinding()];
    const report = { scannedFiles: 1, sourceErrors: [], findings, cssAnalysis: [] };
    const output = toMarkdown(report, BASE_CONFIG, { ci: true });
    assert.ok(output.includes("GitHub Annotations"));
  });

  test("includes GitHub Annotations section in CI mode with no findings", () => {
    const report = { scannedFiles: 1, sourceErrors: [], findings: [], cssAnalysis: [] };
    const output = toMarkdown(report, BASE_CONFIG, { ci: true });
    assert.ok(output.includes("GitHub Annotations"));
  });

  test("includes CSS quality section when cssAnalysis is non-empty", () => {
    const cssAnalysis = [
      {
        file: "styles.css",
        quality: { performance: 90, maintainability: 80, complexity: 70, violations: [] },
        complexityMetrics: { totalRules: 5, sourceLinesOfCode: 20 },
        designTokens: {}
      }
    ];
    const report = { scannedFiles: 1, sourceErrors: [], findings: [], cssAnalysis };
    const output = toMarkdown(report, BASE_CONFIG);
    assert.ok(output.includes("CSS Quality Analysis"));
    assert.ok(output.includes("styles.css"));
  });

  test("reports scan mode when mode is 'urls'", () => {
    const config = { ...BASE_CONFIG, scanMode: "urls", sameOriginOnly: true };
    const report = { scannedFiles: 2, sourceErrors: [], findings: [], cssAnalysis: [] };
    const output = toMarkdown(report, config);
    assert.ok(output.includes("URL crawl"));
  });

  test("includes weighted unsupported share when weightedUnsupportedPercent is a number", () => {
    const findings = [makeFinding({ weightedUnsupportedPercent: 33.3 })];
    const report = { scannedFiles: 1, sourceErrors: [], findings, cssAnalysis: [] };
    const output = toMarkdown(report, BASE_CONFIG);
    assert.ok(output.includes("Weighted unsupported share"));
    assert.ok(output.includes("33.3%"));
  });
});
