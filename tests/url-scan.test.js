"use strict";

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const {
  stripHash,
  resolveAssetUrl,
  detectSourceTypeFromUrl,
  extractLinksByRegex,
  extractAssetUrls
} = require("../src/url-scan.js");

// ---------------------------------------------------------------------------
// stripHash
// ---------------------------------------------------------------------------
describe("stripHash", () => {
  test("returns the URL unchanged when there is no hash", () => {
    assert.equal(stripHash("https://example.com/page"), "https://example.com/page");
  });

  test("strips the hash fragment", () => {
    assert.equal(stripHash("https://example.com/page#section"), "https://example.com/page");
  });

  test("strips the hash even when query string is present", () => {
    assert.equal(
      stripHash("https://example.com/page?q=1#section"),
      "https://example.com/page?q=1"
    );
  });

  test("returns an empty string for a bare '#'", () => {
    assert.equal(stripHash("#"), "");
  });
});

// ---------------------------------------------------------------------------
// resolveAssetUrl
// ---------------------------------------------------------------------------
describe("resolveAssetUrl", () => {
  test("resolves an absolute URL as-is", () => {
    const result = resolveAssetUrl("https://example.com/page", "https://cdn.example.com/app.js");
    assert.equal(result, "https://cdn.example.com/app.js");
  });

  test("resolves a root-relative path against the base URL", () => {
    const result = resolveAssetUrl("https://example.com/sub/page", "/assets/app.js");
    assert.equal(result, "https://example.com/assets/app.js");
  });

  test("resolves a relative path against the base URL", () => {
    const result = resolveAssetUrl("https://example.com/sub/page.html", "style.css");
    assert.equal(result, "https://example.com/sub/style.css");
  });

  test("returns null for an invalid asset path", () => {
    // A completely invalid base URL prevents resolution
    const result = resolveAssetUrl("not-a-url", "app.js");
    assert.equal(result, null);
  });

  test("resolves a protocol-relative URL", () => {
    const result = resolveAssetUrl("https://example.com/page", "//cdn.example.com/lib.js");
    assert.equal(result, "https://cdn.example.com/lib.js");
  });
});

// ---------------------------------------------------------------------------
// detectSourceTypeFromUrl
// ---------------------------------------------------------------------------
describe("detectSourceTypeFromUrl", () => {
  test("returns 'css' for a .css URL", () => {
    assert.equal(detectSourceTypeFromUrl("https://example.com/styles.css"), "css");
  });

  test("returns 'js' for a .js URL", () => {
    assert.equal(detectSourceTypeFromUrl("https://example.com/app.js"), "js");
  });

  test("returns 'js' for a .mjs URL", () => {
    assert.equal(detectSourceTypeFromUrl("https://example.com/module.mjs"), "js");
  });

  test("returns 'js' for a .cjs URL", () => {
    assert.equal(detectSourceTypeFromUrl("https://example.com/bundle.cjs"), "js");
  });

  test("returns 'unknown' for a .png URL", () => {
    assert.equal(detectSourceTypeFromUrl("https://example.com/image.png"), "unknown");
  });

  test("returns 'unknown' for an .html URL", () => {
    assert.equal(detectSourceTypeFromUrl("https://example.com/page.html"), "unknown");
  });

  test("is case-insensitive", () => {
    assert.equal(detectSourceTypeFromUrl("https://example.com/STYLES.CSS"), "css");
    assert.equal(detectSourceTypeFromUrl("https://example.com/APP.JS"), "js");
  });

  test("handles URLs with query strings", () => {
    assert.equal(detectSourceTypeFromUrl("https://example.com/styles.css?v=2"), "css");
  });
});

// ---------------------------------------------------------------------------
// extractLinksByRegex
// ---------------------------------------------------------------------------
describe("extractLinksByRegex", () => {
  const scriptRegex = /<script[^>]*\ssrc=["']([^"']+)["'][^>]*>/gi;

  test("returns an empty array for HTML with no script tags", () => {
    assert.deepEqual(extractLinksByRegex("<p>Hello</p>", scriptRegex, 1), []);
  });

  test("extracts a single script src", () => {
    const html = '<script src="/app.js"></script>';
    const result = extractLinksByRegex(html, scriptRegex, 1);
    assert.deepEqual(result, ["/app.js"]);
  });

  test("extracts multiple script srcs", () => {
    const html = '<script src="/a.js"></script><script src="/b.js"></script>';
    const result = extractLinksByRegex(html, scriptRegex, 1);
    assert.deepEqual(result, ["/a.js", "/b.js"]);
  });

  test("ignores inline script tags (no src attribute)", () => {
    const html = "<script>console.log('hi');</script>";
    const result = extractLinksByRegex(html, scriptRegex, 1);
    assert.deepEqual(result, []);
  });

  test("trims whitespace from extracted values", () => {
    const html = '<script src="  /app.js  "></script>';
    const result = extractLinksByRegex(html, scriptRegex, 1);
    assert.deepEqual(result, ["/app.js"]);
  });
});

// ---------------------------------------------------------------------------
// extractAssetUrls
// ---------------------------------------------------------------------------
describe("extractAssetUrls", () => {
  const BASE = "https://example.com/page.html";

  test("returns an empty array for HTML with no assets", () => {
    assert.deepEqual(extractAssetUrls("<p>Hello</p>", BASE), []);
  });

  test("extracts a script src", () => {
    const html = '<script src="/app.js"></script>';
    const result = extractAssetUrls(html, BASE);
    assert.ok(result.includes("https://example.com/app.js"));
  });

  test("extracts a stylesheet href", () => {
    const html = '<link rel="stylesheet" href="/styles.css">';
    const result = extractAssetUrls(html, BASE);
    assert.ok(result.includes("https://example.com/styles.css"));
  });

  test("handles href-before-rel order in <link>", () => {
    const html = '<link href="/other.css" rel="stylesheet">';
    const result = extractAssetUrls(html, BASE);
    assert.ok(result.includes("https://example.com/other.css"));
  });

  test("ignores <link> tags that are not stylesheets", () => {
    const html = '<link rel="icon" href="/favicon.ico"><link rel="canonical" href="/page">';
    const result = extractAssetUrls(html, BASE);
    assert.deepEqual(result, []);
  });

  test("ignores data: URIs", () => {
    const html = '<script src="data:text/javascript,console.log(1)"></script>';
    const result = extractAssetUrls(html, BASE);
    assert.deepEqual(result, []);
  });

  test("deduplicates the same asset referenced multiple times", () => {
    const html = '<script src="/app.js"></script><script src="/app.js"></script>';
    const result = extractAssetUrls(html, BASE);
    const count = result.filter((u) => u.endsWith("/app.js")).length;
    assert.equal(count, 1);
  });

  test("extracts both scripts and stylesheets together", () => {
    const html = '<script src="/app.js"></script><link rel="stylesheet" href="/styles.css">';
    const result = extractAssetUrls(html, BASE);
    assert.ok(result.includes("https://example.com/app.js"));
    assert.ok(result.includes("https://example.com/styles.css"));
  });

  test("resolves relative asset paths against the page URL", () => {
    const html = '<script src="js/app.js"></script>';
    const base = "https://example.com/subdir/page.html";
    const result = extractAssetUrls(html, base);
    assert.ok(result.includes("https://example.com/subdir/js/app.js"));
  });

  test("handles absolute asset URLs", () => {
    const html = '<script src="https://cdn.example.com/lib.js"></script>';
    const result = extractAssetUrls(html, BASE);
    assert.ok(result.includes("https://cdn.example.com/lib.js"));
  });
});
