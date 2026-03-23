const { URL } = require("node:url");

function stripHash(href) {
  return href.split("#")[0];
}

function resolveAssetUrl(baseUrl, assetPath) {
  try {
    return new URL(assetPath, baseUrl).toString();
  } catch {
    return null;
  }
}

function detectSourceTypeFromUrl(assetUrl) {
  const lowered = assetUrl.toLowerCase();
  if (lowered.endsWith(".css")) {
    return "css";
  }

  if (lowered.endsWith(".js") || lowered.endsWith(".mjs") || lowered.endsWith(".cjs")) {
    return "js";
  }

  return "unknown";
}

function extractLinksByRegex(html, regex, attrIndex) {
  const matches = [];
  for (const match of html.matchAll(regex)) {
    const value = match[attrIndex];
    if (value) {
      matches.push(value.trim());
    }
  }

  return matches;
}

function extractAssetUrls(html, pageUrl) {
  const scriptSrcs = extractLinksByRegex(
    html,
    /<script[^>]*\ssrc=["']([^"']+)["'][^>]*>/gi,
    1
  );

  // Extract stylesheet hrefs using a two-step approach so that the href and rel
  // attributes can appear in any order (e.g. <link href="..." rel="stylesheet">
  // is just as valid as <link rel="stylesheet" href="...">).
  const stylesheetHrefs = [];
  for (const linkMatch of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = linkMatch[0];
    if (!/\brel=["'][^"']*stylesheet[^"']*["']/i.test(tag)) {
      continue;
    }
    const hrefMatch = tag.match(/\bhref=["']([^"']+)["']/i);
    if (hrefMatch) {
      stylesheetHrefs.push(hrefMatch[1].trim());
    }
  }

  const urls = new Set();
  for (const href of [...scriptSrcs, ...stylesheetHrefs]) {
    if (!href || href.startsWith("data:")) {
      continue;
    }

    const resolved = resolveAssetUrl(pageUrl, stripHash(href));
    if (resolved) {
      urls.add(resolved);
    }
  }

  return [...urls];
}

async function fetchText(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "open-site-review/0.2"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
    }

    return response.text();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Fetch timed out after ${timeoutMs}ms: ${url}`);
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSourcesFromUrls(urls, options = {}) {
  const includeAssets = options.includeLinkedAssets !== false;
  const sameOriginOnly = options.sameOriginOnly !== false;

  const sources = [];
  const errors = [];
  const seen = new Set();

  for (const pageUrl of urls) {
    try {
      const html = await fetchText(pageUrl);
      sources.push({
        location: pageUrl,
        sourceType: "html",
        text: html
      });

      if (!includeAssets) {
        continue;
      }

      const pageOrigin = new URL(pageUrl).origin;
      const assets = extractAssetUrls(html, pageUrl);

      for (const assetUrl of assets) {
        if (seen.has(assetUrl)) {
          continue;
        }

        if (sameOriginOnly && new URL(assetUrl).origin !== pageOrigin) {
          continue;
        }

        const sourceType = detectSourceTypeFromUrl(assetUrl);
        if (sourceType === "unknown") {
          continue;
        }

        seen.add(assetUrl);
        try {
          const text = await fetchText(assetUrl);
          sources.push({
            location: assetUrl,
            sourceType,
            text
          });
        } catch (error) {
          errors.push({
            location: assetUrl,
            message: error.message
          });
        }
      }
    } catch (error) {
      errors.push({
        location: pageUrl,
        message: error.message
      });
    }
  }

  return {
    sources,
    errors
  };
}

module.exports = {
  fetchSourcesFromUrls
};
