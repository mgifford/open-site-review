"use strict";

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const {
  isHtmlUrl,
  extractUrls,
  extractUrlFromTitle,
  parseUrlLimit,
  parseIssueReference,
  extractSitemapLocs
} = require("../src/github-issues.js");

// ---------------------------------------------------------------------------
// isHtmlUrl
// ---------------------------------------------------------------------------
describe("isHtmlUrl", () => {
  test("returns true for a URL with no path extension", () => {
    assert.equal(isHtmlUrl("https://example.com/about"), true);
  });

  test("returns true for a URL ending in /", () => {
    assert.equal(isHtmlUrl("https://example.com/"), true);
  });

  test("returns true for a URL with no path at all", () => {
    assert.equal(isHtmlUrl("https://example.com"), true);
  });

  test("returns true for a .html URL", () => {
    assert.equal(isHtmlUrl("https://example.com/page.html"), true);
  });

  test("returns true for a .htm URL", () => {
    assert.equal(isHtmlUrl("https://example.com/page.htm"), true);
  });

  test("returns false for a .pdf URL", () => {
    assert.equal(isHtmlUrl("https://example.com/report.pdf"), false);
  });

  test("returns false for a .css URL", () => {
    assert.equal(isHtmlUrl("https://example.com/styles.css"), false);
  });

  test("returns false for a .js URL", () => {
    assert.equal(isHtmlUrl("https://example.com/app.js"), false);
  });

  test("returns false for a .json URL", () => {
    assert.equal(isHtmlUrl("https://example.com/data.json"), false);
  });

  test("returns false for image extensions", () => {
    assert.equal(isHtmlUrl("https://example.com/photo.png"), false);
    assert.equal(isHtmlUrl("https://example.com/icon.svg"), false);
    assert.equal(isHtmlUrl("https://example.com/image.webp"), false);
  });

  test("returns false for font extensions", () => {
    assert.equal(isHtmlUrl("https://example.com/font.woff2"), false);
  });

  test("returns false for an invalid (non-parseable) URL", () => {
    assert.equal(isHtmlUrl("not-a-url"), false);
    assert.equal(isHtmlUrl(""), false);
  });

  test("returns true for an unknown extension (not in blocklist)", () => {
    assert.equal(isHtmlUrl("https://example.com/page.aspx"), true);
    assert.equal(isHtmlUrl("https://example.com/page.php"), true);
  });

  test("is case-insensitive for extension matching", () => {
    assert.equal(isHtmlUrl("https://example.com/report.PDF"), false);
    assert.equal(isHtmlUrl("https://example.com/page.HTML"), true);
  });
});

// ---------------------------------------------------------------------------
// extractUrls
// ---------------------------------------------------------------------------
describe("extractUrls", () => {
  test("returns an empty array for null/undefined", () => {
    assert.deepEqual(extractUrls(null), []);
    assert.deepEqual(extractUrls(undefined), []);
  });

  test("returns an empty array for text with no URLs", () => {
    assert.deepEqual(extractUrls("no urls here"), []);
  });

  test("extracts a single HTTP URL", () => {
    const result = extractUrls("Check out https://example.com for details.");
    assert.ok(result.includes("https://example.com"));
  });

  test("extracts multiple URLs", () => {
    const text = "See https://example.com and https://other.org for more.";
    const result = extractUrls(text);
    assert.ok(result.includes("https://example.com"));
    assert.ok(result.includes("https://other.org"));
  });

  test("deduplicates repeated URLs", () => {
    const text = "https://example.com https://example.com https://example.com";
    const result = extractUrls(text);
    assert.equal(result.filter((u) => u === "https://example.com").length, 1);
  });

  test("extracts both http and https URLs", () => {
    const text = "http://legacy.example.com and https://secure.example.com";
    const result = extractUrls(text);
    assert.ok(result.includes("http://legacy.example.com"));
    assert.ok(result.includes("https://secure.example.com"));
  });

  test("does not include bare domain names without a protocol", () => {
    const result = extractUrls("Visit example.com for info.");
    assert.deepEqual(result, []);
  });
});

// ---------------------------------------------------------------------------
// extractUrlFromTitle
// ---------------------------------------------------------------------------
describe("extractUrlFromTitle", () => {
  test("returns null for null/empty title", () => {
    assert.equal(extractUrlFromTitle(null), null);
    assert.equal(extractUrlFromTitle(""), null);
  });

  test("returns null when title has no URL", () => {
    assert.equal(extractUrlFromTitle("SCAN: some website"), null);
  });

  test("extracts a URL from a SCAN: title", () => {
    const result = extractUrlFromTitle("SCAN: https://example.com");
    assert.equal(result, "https://example.com");
  });

  test("strips trailing punctuation from the URL", () => {
    assert.equal(extractUrlFromTitle("See https://example.com."), "https://example.com");
    assert.equal(extractUrlFromTitle("SCAN: https://example.com!"), "https://example.com");
    assert.equal(extractUrlFromTitle("SCAN: https://example.com)"), "https://example.com");
  });

  test("handles URLs with paths", () => {
    const result = extractUrlFromTitle("SCAN: https://example.com/page/subpage");
    assert.equal(result, "https://example.com/page/subpage");
  });

  test("extracts URL even when surrounded by text", () => {
    const result = extractUrlFromTitle("Please scan https://nsf.gov for review");
    assert.equal(result, "https://nsf.gov");
  });
});

// ---------------------------------------------------------------------------
// parseUrlLimit
// ---------------------------------------------------------------------------
describe("parseUrlLimit", () => {
  test("returns null for null/empty body", () => {
    assert.equal(parseUrlLimit(null), null);
    assert.equal(parseUrlLimit(""), null);
  });

  test("parses 'Number: N' directive", () => {
    assert.equal(parseUrlLimit("Number: 10"), 10);
    assert.equal(parseUrlLimit("Number: 1"), 1);
  });

  test("parses 'Pages: N' directive", () => {
    assert.equal(parseUrlLimit("Pages: 25"), 25);
  });

  test("is case-insensitive", () => {
    assert.equal(parseUrlLimit("number: 7"), 7);
    assert.equal(parseUrlLimit("PAGES: 50"), 50);
  });

  test("returns null when the directive is absent", () => {
    assert.equal(parseUrlLimit("Just some random body text without a limit."), null);
  });

  test("parses directive embedded in a longer body", () => {
    const body = "Please scan the following:\nNumber: 15\nhttps://example.com";
    assert.equal(parseUrlLimit(body), 15);
  });
});

// ---------------------------------------------------------------------------
// parseIssueReference
// ---------------------------------------------------------------------------
describe("parseIssueReference", () => {
  test("parses owner/repo#number short format", () => {
    const result = parseIssueReference("mgifford/open-site-review#42");
    assert.equal(result.owner, "mgifford");
    assert.equal(result.repo, "open-site-review");
    assert.equal(result.issueNumber, 42);
  });

  test("parses a full GitHub issue URL", () => {
    const result = parseIssueReference("https://github.com/mgifford/open-site-review/issues/7");
    assert.equal(result.owner, "mgifford");
    assert.equal(result.repo, "open-site-review");
    assert.equal(result.issueNumber, 7);
  });

  test("parses a GitHub issue URL with trailing query string", () => {
    const result = parseIssueReference("https://github.com/mgifford/open-site-review/issues/7?ref=email");
    assert.equal(result.issueNumber, 7);
  });

  test("throws for null input", () => {
    assert.throws(() => parseIssueReference(null), /Missing issue reference/);
  });

  test("throws for an empty string", () => {
    assert.throws(() => parseIssueReference(""), /Missing issue reference/);
  });

  test("throws for a non-issue URL", () => {
    assert.throws(
      () => parseIssueReference("https://github.com/mgifford/open-site-review"),
      /Issue reference must be/
    );
  });

  test("throws for an arbitrary string that is not owner/repo#number", () => {
    assert.throws(() => parseIssueReference("just-random-text"), /Issue reference must be/);
  });

  test("converts issueNumber to a number type", () => {
    const result = parseIssueReference("owner/repo#99");
    assert.equal(typeof result.issueNumber, "number");
    assert.equal(result.issueNumber, 99);
  });

  test("trims leading and trailing whitespace", () => {
    const result = parseIssueReference("  mgifford/open-site-review#5  ");
    assert.equal(result.issueNumber, 5);
  });
});

// ---------------------------------------------------------------------------
// extractSitemapLocs
// ---------------------------------------------------------------------------
describe("extractSitemapLocs", () => {
  test("returns an empty array for empty XML", () => {
    assert.deepEqual(extractSitemapLocs(""), []);
  });

  test("extracts a single <loc> URL", () => {
    const xml = "<urlset><url><loc>https://example.com/page</loc></url></urlset>";
    const result = extractSitemapLocs(xml);
    assert.deepEqual(result, ["https://example.com/page"]);
  });

  test("extracts multiple <loc> URLs", () => {
    const xml = `
      <urlset>
        <url><loc>https://example.com/a</loc></url>
        <url><loc>https://example.com/b</loc></url>
        <url><loc>https://example.com/c</loc></url>
      </urlset>
    `;
    const result = extractSitemapLocs(xml);
    assert.equal(result.length, 3);
    assert.ok(result.includes("https://example.com/a"));
    assert.ok(result.includes("https://example.com/b"));
    assert.ok(result.includes("https://example.com/c"));
  });

  test("only includes URLs that start with http", () => {
    const xml = "<urlset><url><loc>ftp://example.com/file</loc></url><url><loc>https://example.com/ok</loc></url></urlset>";
    const result = extractSitemapLocs(xml);
    assert.deepEqual(result, ["https://example.com/ok"]);
  });

  test("handles whitespace around loc values", () => {
    const xml = "<urlset><url><loc>  https://example.com/spaces  </loc></url></urlset>";
    const result = extractSitemapLocs(xml);
    assert.deepEqual(result, ["https://example.com/spaces"]);
  });

  test("is case-insensitive for <LOC> tags", () => {
    const xml = "<urlset><url><LOC>https://example.com/upper</LOC></url></urlset>";
    const result = extractSitemapLocs(xml);
    assert.deepEqual(result, ["https://example.com/upper"]);
  });
});
