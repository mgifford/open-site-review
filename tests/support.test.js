"use strict";

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const {
  getByPath,
  parseMajorVersion,
  familyFromTarget,
  isBcdSupportEntrySupported,
  normalizeAudienceWeights,
  weightedUnsupportedPercent,
  evaluateSupport,
  getMdnMetadata
} = require("../src/support.js");

// ---------------------------------------------------------------------------
// getByPath
// ---------------------------------------------------------------------------
describe("getByPath", () => {
  const obj = { a: { b: { c: 42 } }, z: "top" };

  test("returns a deeply nested value", () => {
    assert.equal(getByPath(obj, "a.b.c"), 42);
  });

  test("returns an intermediate object", () => {
    assert.deepEqual(getByPath(obj, "a.b"), { c: 42 });
  });

  test("returns a top-level value", () => {
    assert.equal(getByPath(obj, "z"), "top");
  });

  test("returns undefined for a missing key", () => {
    assert.equal(getByPath(obj, "a.x.y"), undefined);
  });

  test("returns undefined for an empty path", () => {
    assert.equal(getByPath(obj, ""), undefined);
  });

  test("returns undefined for a null path", () => {
    assert.equal(getByPath(obj, null), undefined);
  });

  test("returns undefined when root is null", () => {
    assert.equal(getByPath(null, "a.b"), undefined);
  });

  test("case-insensitive key fallback", () => {
    const mixed = { HTML: { Elements: { Dialog: 99 } } };
    assert.equal(getByPath(mixed, "html.elements.dialog"), 99);
  });
});

// ---------------------------------------------------------------------------
// parseMajorVersion
// ---------------------------------------------------------------------------
describe("parseMajorVersion", () => {
  test("returns a number as-is", () => {
    assert.equal(parseMajorVersion(90), 90);
  });

  test("parses a plain numeric string", () => {
    assert.equal(parseMajorVersion("90"), 90);
  });

  test("parses a decimal version string", () => {
    assert.equal(parseMajorVersion("14.5"), 14.5);
  });

  test("strips comparison operators", () => {
    assert.equal(parseMajorVersion(">= 88"), 88);
    assert.equal(parseMajorVersion("< 90"), 90);
    assert.equal(parseMajorVersion("~14"), 14);
  });

  test("returns the first number in a range string", () => {
    // e.g. iOS Safari "14.0-14.5"
    assert.equal(parseMajorVersion("14.0-14.5"), 14);
  });

  test("returns null for non-numeric strings", () => {
    assert.equal(parseMajorVersion("all"), null);
    assert.equal(parseMajorVersion(""), null);
  });

  test("returns null for null", () => {
    assert.equal(parseMajorVersion(null), null);
  });

  test("returns null for undefined", () => {
    assert.equal(parseMajorVersion(undefined), null);
  });

  test("returns null for boolean false", () => {
    assert.equal(parseMajorVersion(false), null);
  });
});

// ---------------------------------------------------------------------------
// familyFromTarget
// ---------------------------------------------------------------------------
describe("familyFromTarget", () => {
  test("extracts simple browser family", () => {
    assert.equal(familyFromTarget("chrome 90"), "chrome");
  });

  test("preserves underscores in family names", () => {
    assert.equal(familyFromTarget("ios_saf 14"), "ios_saf");
    assert.equal(familyFromTarget("and_chr 90"), "and_chr");
  });

  test("returns the whole string if there is no space", () => {
    assert.equal(familyFromTarget("firefox"), "firefox");
  });
});

// ---------------------------------------------------------------------------
// isBcdSupportEntrySupported
// ---------------------------------------------------------------------------
describe("isBcdSupportEntrySupported", () => {
  test("returns false for undefined", () => {
    assert.equal(isBcdSupportEntrySupported(undefined, 90), false);
  });

  test("returns false for null", () => {
    assert.equal(isBcdSupportEntrySupported(null, 90), false);
  });

  test("returns false when version_removed is set", () => {
    assert.equal(isBcdSupportEntrySupported({ version_removed: "80", version_added: "50" }, 90), false);
  });

  test("returns false when version_added is false", () => {
    assert.equal(isBcdSupportEntrySupported({ version_added: false }, 90), false);
  });

  test("returns true when version_added is true", () => {
    assert.equal(isBcdSupportEntrySupported({ version_added: true }, 90), true);
  });

  test("returns true when browser version meets the required version", () => {
    assert.equal(isBcdSupportEntrySupported({ version_added: "80" }, 90), true);
    assert.equal(isBcdSupportEntrySupported({ version_added: "90" }, 90), true);
  });

  test("returns false when browser version is below the required version", () => {
    assert.equal(isBcdSupportEntrySupported({ version_added: "91" }, 90), false);
  });

  test("returns false when version_added is null", () => {
    assert.equal(isBcdSupportEntrySupported({ version_added: null }, 90), false);
  });

  test("returns true for an array if any entry is supported", () => {
    const arr = [{ version_added: false }, { version_added: "80" }];
    assert.equal(isBcdSupportEntrySupported(arr, 90), true);
  });

  test("returns false for an array when no entry is supported", () => {
    const arr = [{ version_added: false }, { version_added: "95" }];
    assert.equal(isBcdSupportEntrySupported(arr, 90), false);
  });

  test("returns false for an empty array", () => {
    assert.equal(isBcdSupportEntrySupported([], 90), false);
  });
});

// ---------------------------------------------------------------------------
// normalizeAudienceWeights
// ---------------------------------------------------------------------------
describe("normalizeAudienceWeights", () => {
  test("returns null for null input", () => {
    assert.equal(normalizeAudienceWeights(null), null);
  });

  test("returns null for undefined input", () => {
    assert.equal(normalizeAudienceWeights(undefined), null);
  });

  test("returns null for a non-object input", () => {
    assert.equal(normalizeAudienceWeights("chrome"), null);
    assert.equal(normalizeAudienceWeights(42), null);
  });

  test("returns null for an empty object", () => {
    assert.equal(normalizeAudienceWeights({}), null);
  });

  test("returns null when all weights are zero", () => {
    assert.equal(normalizeAudienceWeights({ chrome: 0, firefox: 0 }), null);
  });

  test("normalizes weights to sum to 1", () => {
    const result = normalizeAudienceWeights({ chrome: 2, firefox: 8 });
    assert.ok(result !== null);
    assert.ok(Math.abs(result.chrome - 0.2) < 1e-10);
    assert.ok(Math.abs(result.firefox - 0.8) < 1e-10);
  });

  test("filters out negative and zero values", () => {
    const result = normalizeAudienceWeights({ chrome: -1, firefox: 0, safari: 4 });
    assert.ok(result !== null);
    assert.equal(result.chrome, undefined);
    assert.equal(result.firefox, undefined);
    assert.ok(Math.abs(result.safari - 1.0) < 1e-10);
  });

  test("lowercases all keys", () => {
    const result = normalizeAudienceWeights({ Chrome: 1, Firefox: 1 });
    assert.ok(result !== null);
    assert.ok("chrome" in result);
    assert.ok("firefox" in result);
    assert.equal(result.Chrome, undefined);
  });

  test("already-normalized weights are kept as-is", () => {
    const result = normalizeAudienceWeights({ chrome: 0.6, safari: 0.4 });
    assert.ok(result !== null);
    assert.ok(Math.abs(result.chrome - 0.6) < 1e-10);
    assert.ok(Math.abs(result.safari - 0.4) < 1e-10);
  });
});

// ---------------------------------------------------------------------------
// weightedUnsupportedPercent
// ---------------------------------------------------------------------------
describe("weightedUnsupportedPercent", () => {
  test("returns null when audienceWeights is null", () => {
    assert.equal(weightedUnsupportedPercent(["chrome 90"], ["chrome 90"], null), null);
  });

  test("returns null when audienceWeights is empty", () => {
    assert.equal(weightedUnsupportedPercent(["chrome 90"], [], {}), null);
  });

  test("returns null when no target families match the weights", () => {
    const result = weightedUnsupportedPercent(
      ["chrome 90"],
      ["chrome 90"],
      { safari: 1 }
    );
    assert.equal(result, null);
  });

  test("returns 0 when all targets are supported", () => {
    const result = weightedUnsupportedPercent(
      ["chrome 90", "firefox 90"],
      [],
      { chrome: 0.7, firefox: 0.3 }
    );
    assert.ok(result !== null);
    assert.ok(Math.abs(result - 0) < 1e-10);
  });

  test("returns 100 when all weighted targets are unsupported", () => {
    const result = weightedUnsupportedPercent(
      ["chrome 90"],
      ["chrome 90"],
      { chrome: 1 }
    );
    assert.ok(result !== null);
    assert.ok(Math.abs(result - 100) < 1e-10);
  });

  test("calculates weighted percentage correctly", () => {
    // chrome (weight 0.4) is unsupported; firefox (weight 0.6) is supported
    const result = weightedUnsupportedPercent(
      ["chrome 90", "firefox 90"],
      ["chrome 90"],
      { chrome: 0.4, firefox: 0.6 }
    );
    assert.ok(result !== null);
    // 0.4 / (0.4 + 0.6) * 100 = 40
    assert.ok(Math.abs(result - 40) < 1e-10);
  });
});

// ---------------------------------------------------------------------------
// evaluateSupport (integration-level tests using real caniuse / browserslist)
// ---------------------------------------------------------------------------
describe("evaluateSupport", () => {
  test("returns 0% unsupported when feature is null", () => {
    const result = evaluateSupport(null, "last 1 chrome version");
    assert.equal(result.unsupportedPercent, 0);
    assert.equal(result.error, null);
    assert.ok(result.supportedTargets.length > 0);
    assert.deepEqual(result.unsupportedTargets, []);
  });

  test("returns a result object with all expected keys", () => {
    const result = evaluateSupport("css-grid", "last 1 chrome version");
    const keys = ["targets", "supportedTargets", "unsupportedTargets", "unsupportedPercent", "error"];
    for (const key of keys) {
      assert.ok(key in result, `Missing key: ${key}`);
    }
  });

  test("css-grid is fully supported in modern Chrome", () => {
    const result = evaluateSupport("css-grid", "chrome >= 80");
    assert.equal(result.unsupportedPercent, 0);
    assert.equal(result.error, null);
  });

  test("returns an error for an unknown caniuse feature", () => {
    const result = evaluateSupport("this-feature-xyz-does-not-exist", "chrome 90");
    assert.ok(result.error, "Expected an error message");
    assert.equal(result.unsupportedPercent, 100);
  });

  test("falls back to MDN when caniuse feature is unknown but mdnPath is given", () => {
    const result = evaluateSupport(
      "this-feature-xyz-does-not-exist",
      "chrome 90",
      { mdnPath: "html.elements.dialog" }
    );
    // MDN fallback path is taken; should not throw
    assert.ok(typeof result.unsupportedPercent === "number");
  });

  test("includes weightedUnsupportedPercent when audienceWeights are provided", () => {
    const result = evaluateSupport("css-grid", "chrome >= 80", {
      audienceWeights: { chrome: 1 }
    });
    assert.ok(typeof result.weightedUnsupportedPercent === "number");
  });
});

// ---------------------------------------------------------------------------
// getMdnMetadata
// ---------------------------------------------------------------------------
describe("getMdnMetadata", () => {
  test("returns found:true for a valid MDN path", () => {
    const meta = getMdnMetadata("html.elements.dialog");
    assert.equal(meta.found, true);
  });

  test("returns boolean deprecated field for a valid path", () => {
    const meta = getMdnMetadata("html.elements.dialog");
    assert.equal(typeof meta.deprecated, "boolean");
  });

  test("returns boolean experimental field for a valid path", () => {
    const meta = getMdnMetadata("html.elements.dialog");
    assert.equal(typeof meta.experimental, "boolean");
  });

  test("returns boolean standardTrack field for a valid path", () => {
    const meta = getMdnMetadata("html.elements.dialog");
    assert.equal(typeof meta.standardTrack, "boolean");
  });

  test("returns found:false for an unknown path", () => {
    const meta = getMdnMetadata("html.elements.doesnotexist_xyz");
    assert.equal(meta.found, false);
  });

  test("returns found:false for null", () => {
    const meta = getMdnMetadata(null);
    assert.equal(meta.found, false);
  });

  test("returns found:false for undefined", () => {
    const meta = getMdnMetadata(undefined);
    assert.equal(meta.found, false);
  });

  test("returns found:false for an empty string", () => {
    const meta = getMdnMetadata("");
    assert.equal(meta.found, false);
  });

  test("returns a mdn_url or null for a well-known path", () => {
    const meta = getMdnMetadata("html.elements.dialog");
    if (meta.mdnUrl !== null) {
      assert.ok(typeof meta.mdnUrl === "string");
    }
  });
});
