"use strict";

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { splitGlobList, parseArgValue, hasFlag } = require("../src/cli.js");

// ---------------------------------------------------------------------------
// hasFlag
// ---------------------------------------------------------------------------
describe("hasFlag", () => {
  test("returns true when the flag is present", () => {
    assert.equal(hasFlag(["--ci", "--format", "markdown"], "--ci"), true);
  });

  test("returns false when the flag is absent", () => {
    assert.equal(hasFlag(["--format", "markdown"], "--ci"), false);
  });

  test("returns false for an empty argv", () => {
    assert.equal(hasFlag([], "--ci"), false);
  });

  test("is exact-match only (does not match substrings)", () => {
    assert.equal(hasFlag(["--ci-mode"], "--ci"), false);
  });
});

// ---------------------------------------------------------------------------
// parseArgValue
// ---------------------------------------------------------------------------
describe("parseArgValue", () => {
  test("returns the value immediately following the flag", () => {
    const argv = ["--format", "markdown", "--paths", "src/**/*.html"];
    assert.equal(parseArgValue(argv, "--format"), "markdown");
    assert.equal(parseArgValue(argv, "--paths"), "src/**/*.html");
  });

  test("returns null when the flag is not present", () => {
    assert.equal(parseArgValue(["--format", "json"], "--targets"), null);
  });

  test("returns null when the flag is the last argument (no value follows)", () => {
    assert.equal(parseArgValue(["--ci", "--format"], "--format"), null);
  });

  test("returns null for an empty argv", () => {
    assert.equal(parseArgValue([], "--format"), null);
  });
});

// ---------------------------------------------------------------------------
// splitGlobList
// ---------------------------------------------------------------------------
describe("splitGlobList", () => {
  test("returns a single-element array for a lone item", () => {
    assert.deepEqual(splitGlobList("src/**/*.html"), ["src/**/*.html"]);
  });

  test("splits a comma-separated list", () => {
    const result = splitGlobList("src/**/*.html,src/**/*.css,src/**/*.js");
    assert.deepEqual(result, ["src/**/*.html", "src/**/*.css", "src/**/*.js"]);
  });

  test("trims whitespace around each item", () => {
    const result = splitGlobList("  src/**/*.html , src/**/*.css  ");
    assert.deepEqual(result, ["src/**/*.html", "src/**/*.css"]);
  });

  test("does not split on commas inside braces", () => {
    const result = splitGlobList("examples/**/*.{html,css,js}");
    assert.deepEqual(result, ["examples/**/*.{html,css,js}"]);
  });

  test("handles nested braces correctly", () => {
    const result = splitGlobList("src/**/*.{html,css},tests/**/*.{js,mjs}");
    assert.deepEqual(result, ["src/**/*.{html,css}", "tests/**/*.{js,mjs}"]);
  });

  test("returns an empty array for an empty string", () => {
    assert.deepEqual(splitGlobList(""), []);
  });

  test("ignores empty items from trailing/double commas", () => {
    const result = splitGlobList("a.html,,b.css,");
    assert.deepEqual(result, ["a.html", "b.css"]);
  });
});
