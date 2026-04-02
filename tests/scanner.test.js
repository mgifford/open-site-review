"use strict";

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { classifyFinding, sourceTypeFromPath, lineForMatch } = require("../src/scanner.js");

const BASE_CONFIG = {
  unsupportedThresholdPercent: 10,
  removableThresholdPercent: 5
};

// ---------------------------------------------------------------------------
// sourceTypeFromPath
// ---------------------------------------------------------------------------
describe("sourceTypeFromPath", () => {
  test("returns 'html' for .html files", () => {
    assert.equal(sourceTypeFromPath("page.html"), "html");
  });

  test("returns 'html' for .htm files", () => {
    assert.equal(sourceTypeFromPath("page.htm"), "html");
  });

  test("returns 'html' for uppercase .HTML", () => {
    assert.equal(sourceTypeFromPath("PAGE.HTML"), "html");
  });

  test("returns 'css' for .css files", () => {
    assert.equal(sourceTypeFromPath("styles.css"), "css");
  });

  test("returns 'js' for .js files", () => {
    assert.equal(sourceTypeFromPath("app.js"), "js");
  });

  test("returns 'js' for .mjs files", () => {
    assert.equal(sourceTypeFromPath("module.mjs"), "js");
  });

  test("returns 'js' for .cjs files", () => {
    assert.equal(sourceTypeFromPath("bundle.cjs"), "js");
  });

  test("returns 'unknown' for .txt files", () => {
    assert.equal(sourceTypeFromPath("readme.txt"), "unknown");
  });

  test("returns 'unknown' for .json files", () => {
    assert.equal(sourceTypeFromPath("data.json"), "unknown");
  });

  test("returns 'unknown' for files with no extension", () => {
    assert.equal(sourceTypeFromPath("Makefile"), "unknown");
  });

  test("handles paths with multiple dots", () => {
    assert.equal(sourceTypeFromPath("src/components/app.min.js"), "js");
    assert.equal(sourceTypeFromPath("dist/styles.min.css"), "css");
  });

  test("handles absolute paths", () => {
    assert.equal(sourceTypeFromPath("/var/www/index.html"), "html");
  });
});

// ---------------------------------------------------------------------------
// lineForMatch
// ---------------------------------------------------------------------------
describe("lineForMatch", () => {
  test("returns 1 for a match on the first line", () => {
    const line = lineForMatch("<dialog>hello</dialog>", /<dialog/i);
    assert.equal(line, 1);
  });

  test("returns the correct line number for a multi-line string", () => {
    const text = "line1\nline2\n<dialog>content</dialog>\nline4";
    const line = lineForMatch(text, /<dialog/i);
    assert.equal(line, 3);
  });

  test("returns null when the regex does not match", () => {
    assert.equal(lineForMatch("no match here", /<dialog/i), null);
  });

  test("returns null for an empty string", () => {
    assert.equal(lineForMatch("", /<dialog/i), null);
  });

  test("returns 2 for a match on the second line", () => {
    const text = "first line\nsecond line contains dialog\nthird";
    const line = lineForMatch(text, /dialog/i);
    assert.equal(line, 2);
  });

  test("counts trailing newlines correctly", () => {
    const text = "\n\n<dialog>";
    const line = lineForMatch(text, /<dialog/i);
    assert.equal(line, 3);
  });
});

// ---------------------------------------------------------------------------
// classifyFinding
// ---------------------------------------------------------------------------
describe("classifyFinding — modern-feature", () => {
  const modernRule = { type: "modern-feature" };
  const mdn = { deprecated: false };

  test("returns high/too-new when unsupported exceeds threshold", () => {
    const support = { unsupportedPercent: 50, weightedUnsupportedPercent: null };
    const result = classifyFinding(modernRule, support, BASE_CONFIG, mdn);
    assert.ok(result !== null);
    assert.equal(result.severity, "high");
    assert.equal(result.kind, "too-new");
    assert.ok(result.message.includes("50.0%"));
  });

  test("returns null when unsupported is below threshold", () => {
    const support = { unsupportedPercent: 5, weightedUnsupportedPercent: null };
    const result = classifyFinding(modernRule, support, BASE_CONFIG, mdn);
    assert.equal(result, null);
  });

  test("returns null when unsupported equals threshold (not strictly greater)", () => {
    const support = { unsupportedPercent: 10, weightedUnsupportedPercent: null };
    const result = classifyFinding(modernRule, support, BASE_CONFIG, mdn);
    assert.equal(result, null);
  });

  test("uses weightedUnsupportedPercent when available", () => {
    // weightedUnsupportedPercent is 25 (above threshold), unsupportedPercent is 5
    const support = { unsupportedPercent: 5, weightedUnsupportedPercent: 25 };
    const result = classifyFinding(modernRule, support, BASE_CONFIG, mdn);
    assert.ok(result !== null);
    assert.equal(result.severity, "high");
    assert.ok(result.message.includes("25.0%"));
  });
});

describe("classifyFinding — polyfill", () => {
  const polyfillRule = { type: "polyfill" };
  const mdn = { deprecated: false };

  test("returns medium/possibly-obsolete-polyfill when below removable threshold", () => {
    const support = { unsupportedPercent: 2, weightedUnsupportedPercent: null };
    const result = classifyFinding(polyfillRule, support, BASE_CONFIG, mdn);
    assert.ok(result !== null);
    assert.equal(result.severity, "medium");
    assert.equal(result.kind, "possibly-obsolete-polyfill");
    assert.ok(result.message.includes("2.0%"));
  });

  test("returns medium/possibly-obsolete-polyfill when exactly at threshold", () => {
    const support = { unsupportedPercent: 5, weightedUnsupportedPercent: null };
    const result = classifyFinding(polyfillRule, support, BASE_CONFIG, mdn);
    assert.ok(result !== null);
    assert.equal(result.severity, "medium");
    assert.equal(result.kind, "possibly-obsolete-polyfill");
  });

  test("returns low/polyfill-review when above removable threshold", () => {
    const support = { unsupportedPercent: 20, weightedUnsupportedPercent: null };
    const result = classifyFinding(polyfillRule, support, BASE_CONFIG, mdn);
    assert.ok(result !== null);
    assert.equal(result.severity, "low");
    assert.equal(result.kind, "polyfill-review");
    assert.ok(result.message.includes("20.0%"));
  });
});

describe("classifyFinding — legacy-pattern", () => {
  const legacyRule = { type: "legacy-pattern" };
  const support = { unsupportedPercent: 0, weightedUnsupportedPercent: null };

  test("returns high/deprecated-pattern when MDN marks it deprecated", () => {
    const mdn = { deprecated: true };
    const result = classifyFinding(legacyRule, support, BASE_CONFIG, mdn);
    assert.ok(result !== null);
    assert.equal(result.severity, "high");
    assert.equal(result.kind, "deprecated-pattern");
  });

  test("returns low/legacy-modernization-opportunity when not deprecated", () => {
    const mdn = { deprecated: false };
    const result = classifyFinding(legacyRule, support, BASE_CONFIG, mdn);
    assert.ok(result !== null);
    assert.equal(result.severity, "low");
    assert.equal(result.kind, "legacy-modernization-opportunity");
  });
});

describe("classifyFinding — unknown rule type", () => {
  test("returns null for an unrecognised rule type", () => {
    const rule = { type: "unknown-type-xyz" };
    const support = { unsupportedPercent: 50, weightedUnsupportedPercent: null };
    const mdn = { deprecated: false };
    const result = classifyFinding(rule, support, BASE_CONFIG, mdn);
    assert.equal(result, null);
  });
});
