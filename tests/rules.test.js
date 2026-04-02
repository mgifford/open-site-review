"use strict";

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { RULES } = require("../src/rules.js");

describe("RULES array", () => {
  test("contains at least one rule", () => {
    assert.ok(RULES.length > 0);
  });

  test("all rules have required string fields", () => {
    const requiredStrings = ["id", "title", "type", "sourceType", "whyItMatters", "recommendation"];
    for (const rule of RULES) {
      for (const field of requiredStrings) {
        assert.ok(
          typeof rule[field] === "string" && rule[field].length > 0,
          `Rule '${rule.id}' missing or empty field: ${field}`
        );
      }
    }
  });

  test("all rules have a detect function", () => {
    for (const rule of RULES) {
      assert.equal(typeof rule.detect, "function", `Rule '${rule.id}' missing detect function`);
    }
  });

  test("all rule types are valid", () => {
    const validTypes = new Set(["modern-feature", "polyfill", "legacy-pattern"]);
    for (const rule of RULES) {
      assert.ok(validTypes.has(rule.type), `Rule '${rule.id}' has invalid type: '${rule.type}'`);
    }
  });

  test("all rule sourceTypes are valid", () => {
    const validSourceTypes = new Set(["html", "css", "js"]);
    for (const rule of RULES) {
      assert.ok(
        validSourceTypes.has(rule.sourceType),
        `Rule '${rule.id}' has invalid sourceType: '${rule.sourceType}'`
      );
    }
  });

  test("all rule IDs are unique", () => {
    const ids = RULES.map((r) => r.id);
    const uniqueIds = new Set(ids);
    assert.equal(ids.length, uniqueIds.size, "Duplicate rule IDs found");
  });
});

describe("rule detect() — positive matches", () => {
  const matchingTexts = {
    "html-dialog": '<dialog id="confirm">Are you sure?</dialog>',
    "html-details-summary": "<details><summary>Toggle</summary><p>content</p></details>",
    "html-popover-api": '<button popovertarget="tip">Open</button><div popover>tip</div>',
    "css-has-selector": "nav li:has(> a.active) { font-weight: bold; }",
    "css-container-queries": "@container sidebar (min-width: 300px) { .card { display: flex; } }",
    "css-subgrid": ".grid { grid-template-columns: subgrid; }",
    "js-optional-chaining": "const val = obj?.nested?.prop;",
    "js-nullish-coalescing": 'const label = input ?? "default";',
    "polyfill-io": '<script src="https://cdn.polyfill.io/v3/polyfill.min.js"></script>',
    "intersection-observer-polyfill": 'require("intersection-observer");',
    "resize-observer-polyfill": 'import "resize-observer-polyfill";',
    "webcomponents-polyfill": 'import "@webcomponents/webcomponentsjs";',
    "core-js-import": 'require("core-js/stable");',
    "regenerator-runtime": 'require("regenerator-runtime/runtime");',
    "jquery-legacy": "$(document).ready(function() { });",
    "document-write": 'document.write("<p>hello</p>");',
    "sync-xhr": 'xhr.open("GET", "/api/data", false);'
  };

  for (const [id, text] of Object.entries(matchingTexts)) {
    test(`'${id}' detect() returns true for a matching snippet`, () => {
      const rule = RULES.find((r) => r.id === id);
      assert.ok(rule, `Rule not found: ${id}`);
      assert.equal(rule.detect(text), true);
    });
  }
});

describe("rule detect() — negative matches", () => {
  test("all rules return false for an empty string", () => {
    for (const rule of RULES) {
      assert.equal(rule.detect(""), false, `Rule '${rule.id}' matched empty string`);
    }
  });

  test("all rules return false for unrelated content", () => {
    const unrelated = "Hello world, nothing special here.";
    for (const rule of RULES) {
      assert.equal(rule.detect(unrelated), false, `Rule '${rule.id}' matched unrelated text`);
    }
  });

  test("css-has-selector does not match plain function calls", () => {
    const rule = RULES.find((r) => r.id === "css-has-selector");
    assert.equal(rule.detect("if (foo.has(bar)) { return; }"), false);
  });

  test("js-optional-chaining does not match ternary with decimal number", () => {
    const rule = RULES.find((r) => r.id === "js-optional-chaining");
    // '?.5' should NOT be flagged (numeric literal, not optional chaining)
    assert.equal(rule.detect("x = a?.5 : b"), false);
  });

  test("js-nullish-coalescing does not match ??= or ???", () => {
    const rule = RULES.find((r) => r.id === "js-nullish-coalescing");
    assert.equal(rule.detect("x ??= 5;"), false);
    assert.equal(rule.detect("x ???= 5;"), false);
  });

  test("css-container-queries matches container-type shorthand too", () => {
    const rule = RULES.find((r) => r.id === "css-container-queries");
    assert.equal(rule.detect(".sidebar { container-type: inline-size; }"), true);
  });
});
