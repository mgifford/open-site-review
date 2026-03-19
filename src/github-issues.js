const { URL } = require("node:url");

// File extensions that are definitively non-HTML. Paths with no extension or
// with .html / .htm are considered HTML and pass the filter.
const NON_HTML_EXTENSIONS = new Set([
  "pdf", "xml", "csv",
  "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "zip", "tar", "gz", "bz2", "7z", "rar",
  "jpg", "jpeg", "png", "gif", "svg", "webp", "ico", "bmp", "tiff",
  "mp4", "mp3", "wav", "ogg", "avi", "mov", "wmv", "flv",
  "json", "txt", "css", "js", "mjs", "cjs", "ts",
  "rss", "atom",
  "woff", "woff2", "ttf", "eot", "otf"
]);

function isHtmlUrl(rawUrl) {
  try {
    const pathname = new URL(rawUrl).pathname.toLowerCase();
    const lastSegment = pathname.split("/").pop();
    if (!lastSegment || !lastSegment.includes(".")) {
      return true; // no extension → almost certainly an HTML page
    }
    const ext = lastSegment.split(".").pop();
    return !NON_HTML_EXTENSIONS.has(ext);
  } catch {
    return false;
  }
}

function extractUrls(text) {
  if (!text) {
    return [];
  }

  const matches = text.match(/https?:\/\/[^\s)]+/gi) || [];
  const deduped = new Set(matches.map((url) => url.trim()));
  return [...deduped];
}

function extractUrlFromTitle(title) {
  if (!title) return null;
  const match = title.match(/https?:\/\/[^\s]+/i);
  if (!match) return null;
  // Strip trailing punctuation that can appear in markdown / GitHub titles
  return match[0].replace(/[.,;:!?)]+$/, "");
}

function parseUrlLimit(body) {
  if (!body) return null;
  const match = body.match(/^(?:Number|Pages)\s*:\s*(\d+)/im);
  return match ? parseInt(match[1], 10) : null;
}

async function fetchTextInternal(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "open-site-review/0.3" }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Timeout fetching ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function extractSitemapLocs(xml) {
  const urls = [];
  for (const match of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
    const u = match[1].trim();
    if (u.startsWith("http")) urls.push(u);
  }
  return urls;
}

/**
 * Fetch HTML page URLs from a site's sitemap.xml.
 * Returns an array of HTML URLs (up to `limit`), or null if the sitemap
 * could not be loaded.
 */
async function fetchSitemapUrls(siteUrl, limit) {
  let origin;
  try {
    origin = new URL(siteUrl).origin;
  } catch {
    return null;
  }

  const sitemapUrl = `${origin}/sitemap.xml`;
  let xml;
  try {
    xml = await fetchTextInternal(sitemapUrl);
  } catch {
    return null; // signals "sitemap not available"
  }

  const isSitemapIndex = /<sitemapindex/i.test(xml);

  if (isSitemapIndex) {
    const subUrls = extractSitemapLocs(xml);
    const collected = [];
    const visited = new Set([sitemapUrl]);

    for (const subUrl of subUrls) {
      if (collected.length >= limit) break;
      if (visited.has(subUrl)) continue;
      visited.add(subUrl);

      try {
        const subXml = await fetchTextInternal(subUrl);
        const locs = extractSitemapLocs(subXml).filter(isHtmlUrl);
        collected.push(...locs);
      } catch {
        // skip failed sub-sitemap
      }
    }

    return [...new Set(collected)].slice(0, limit);
  }

  // Regular sitemap
  return [...new Set(extractSitemapLocs(xml).filter(isHtmlUrl))].slice(0, limit);
}

/**
 * BFS-crawl a site starting from `siteUrl`, collecting same-origin HTML page
 * URLs. Stops once `limit` URLs are collected or the queue is exhausted.
 */
async function crawlSiteUrls(siteUrl, limit) {
  let origin;
  try {
    origin = new URL(siteUrl).origin;
  } catch {
    return [];
  }

  const seen = new Set();
  const results = [];
  const queue = [siteUrl];

  while (queue.length > 0 && results.length < limit) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);

    if (!isHtmlUrl(url)) continue;

    let html;
    try {
      html = await fetchTextInternal(url);
    } catch {
      continue;
    }

    results.push(url);
    if (results.length >= limit) break;

    // Simple regex handles the vast majority of real-world HTML (quoted attrs).
    // Unquoted / escaped attributes are a known edge-case not worth a full parser.
    for (const match of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)) {
      const href = match[1].trim();
      if (!href || href.startsWith("#") || href.startsWith("javascript:") ||
          href.startsWith("mailto:") || href.startsWith("data:") || href.startsWith("vbscript:")) {
        continue;
      }
      try {
        const resolved = new URL(href, url).toString().split("#")[0];
        if (new URL(resolved).origin === origin && !seen.has(resolved)) {
          queue.push(resolved);
        }
      } catch {
        // skip malformed hrefs
      }
    }
  }

  return results;
}

async function updateIssueBody(issueRef, token, newBody) {
  const { owner, repo, issueNumber } = parseIssueReference(issueRef);
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;

  const headers = {
    "user-agent": "open-site-review/0.3",
    accept: "application/vnd.github+json",
    "content-type": "application/json"
  };

  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(apiUrl, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ body: newBody })
  });

  if (!response.ok) {
    throw new Error(`Could not update issue body: HTTP ${response.status}`);
  }
}

function parseIssueReference(input) {
  if (!input) {
    throw new Error("Missing issue reference.");
  }

  const trimmed = input.trim();

  const urlMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)(?:[/?#].*)?$/i
  );
  if (urlMatch) {
    return {
      owner: urlMatch[1],
      repo: urlMatch[2],
      issueNumber: Number(urlMatch[3])
    };
  }

  const shortMatch = trimmed.match(/^([^/]+)\/([^#]+)#(\d+)$/);
  if (shortMatch) {
    return {
      owner: shortMatch[1],
      repo: shortMatch[2],
      issueNumber: Number(shortMatch[3])
    };
  }

  throw new Error(
    "Issue reference must be a GitHub issue URL or owner/repo#number."
  );
}

async function fetchIssueIssueBody(issueRef, token) {
  const { owner, repo, issueNumber } = parseIssueReference(issueRef);
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;

  const headers = {
    "user-agent": "open-site-review/0.3",
    accept: "application/vnd.github+json"
  };

  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(apiUrl, { headers });
  if (!response.ok) {
    throw new Error(`Could not fetch issue ${issueRef}: HTTP ${response.status}`);
  }

  const data = await response.json();
  return {
    owner,
    repo,
    issueNumber,
    body: data.body || "",
    title: data.title || ""
  };
}

async function resolveUrlsFromIssue(issueRef, token) {
  const issue = await fetchIssueIssueBody(issueRef, token);
  const urls = extractUrls(issue.body);

  // Fast path: body already contains URLs — use them as-is
  if (urls.length > 0) {
    return { issue, urls };
  }

  // Lazy fallback: look for a URL in the issue title (e.g. "SCAN: https://nsf.gov")
  const titleUrl = extractUrlFromTitle(issue.title);
  if (!titleUrl) {
    return { issue, urls: [] };
  }

  const urlLimit = parseUrlLimit(issue.body) || 100;

  let discoveredUrls = null;
  let discoverySource = "sitemap.xml";

  // Step 1: try sitemap.xml
  discoveredUrls = await fetchSitemapUrls(titleUrl, urlLimit);

  // Step 2: fall back to crawling if sitemap was unavailable or yielded nothing
  if (!discoveredUrls || discoveredUrls.length === 0) {
    discoverySource = "crawl";
    discoveredUrls = await crawlSiteUrls(titleUrl, urlLimit);
  }

  if (!discoveredUrls || discoveredUrls.length === 0) {
    return { issue, urls: [] };
  }

  // Step 3: write the discovered URLs back into the issue body so that
  // re-opening the issue will scan the exact same set of pages.
  // toISOString() always returns UTC so the date is timezone-independent.
  const timestamp = new Date().toISOString().split("T")[0];
  const header = `URLs discovered automatically on ${timestamp} via ${discoverySource}:`;
  const urlBlock = discoveredUrls.join("\n");
  const existingBody = issue.body.trim();
  const newBody = existingBody
    ? `${existingBody}\n\n${header}\n${urlBlock}`
    : `${header}\n${urlBlock}`;

  if (!token) {
    console.error(`Warning: GITHUB_TOKEN not set — discovered URLs will not be saved to issue ${issueRef}. Re-opening the issue will re-run discovery.`);
  } else {
    try {
      await updateIssueBody(issueRef, token, newBody);
    } catch (err) {
      console.error(`Warning: could not update body of issue ${issueRef}: ${err.message}`);
    }
  }

  return { issue: { ...issue, body: newBody }, urls: discoveredUrls };
}

module.exports = {
  resolveUrlsFromIssue
};
