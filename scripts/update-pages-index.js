#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

function readJsonSafe(filePath, fallback) {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toAbsoluteUrl(input) {
  try {
    return new URL(input).toString();
  } catch {
    return "";
  }
}

function reportHtmlPath(reportPath) {
  return reportPath.replace(/\.md$/, ".html");
}

function renderMarkdown(text) {
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function inline(s) {
    // s has already been HTML-escaped; do not double-escape captured groups
    return s
      .replace(/\*\*(.+?)\*\*/g, (_, t) => `<strong>${t}</strong>`)
      .replace(/`([^`]+)`/g, (_, t) => `<code>${t}</code>`)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_, label, url) =>
        `<a href="${url}">${label}</a>`
      );
  }

  const lines = text.split("\n");
  const out = [];
  let inList = false;
  let inPre = false;
  let preLines = [];

  function closeList() {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  }

  for (const raw of lines) {
    if (inPre) {
      if (raw.trimEnd() === "```") {
        out.push(`<pre><code>${esc(preLines.join("\n"))}</code></pre>`);
        inPre = false;
        preLines = [];
      } else {
        preLines.push(raw);
      }
      continue;
    }

    if (raw.startsWith("```")) {
      closeList();
      inPre = true;
      preLines = [];
      continue;
    }

    if (raw.startsWith("### ")) {
      closeList();
      out.push(`<h3>${inline(esc(raw.slice(4)))}</h3>`);
    } else if (raw.startsWith("## ")) {
      closeList();
      out.push(`<h2>${inline(esc(raw.slice(3)))}</h2>`);
    } else if (raw.startsWith("# ")) {
      closeList();
      out.push(`<h1>${inline(esc(raw.slice(2)))}</h1>`);
    } else if (raw.startsWith("- ")) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(esc(raw.slice(2)))}</li>`);
    } else if (raw.trim() === "") {
      closeList();
    } else {
      closeList();
      out.push(`<p>${inline(esc(raw))}</p>`);
    }
  }

  closeList();
  if (inPre) {
    out.push(`<pre><code>${esc(preLines.join("\n"))}</code></pre>`);
  }

  return out.join("\n");
}

function buildReportHtml(markdownContent, title) {
  const safeTitle = escapeHtml(title || "Open Site Review Report");
  const renderedBody = renderMarkdown(markdownContent);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<style>
:root {
  --bg: #f4f7f4;
  --surface: #ffffff;
  --ink: #15201d;
  --muted: #5a6b64;
  --line: #d6e2dc;
  --accent: #0b6e4f;
  --code-bg: #eef1ef;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
  background: radial-gradient(circle at 10% 10%, #e7f6ef 0%, var(--bg) 55%);
  color: var(--ink);
}
main {
  max-width: 860px;
  margin: 2rem auto;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 2rem 2.5rem;
  box-shadow: 0 6px 24px rgba(7, 24, 16, 0.08);
}
nav { margin-bottom: 1.5rem; font-size: .9rem; }
a { color: var(--accent); }
h1 { font-size: 1.8rem; margin: 0 0 1rem 0; }
h2 { font-size: 1.25rem; margin: 1.5rem 0 .5rem 0; border-bottom: 1px solid var(--line); padding-bottom: .3rem; }
h3 { font-size: 1.05rem; margin: 1.25rem 0 .4rem 0; }
ul { padding-left: 1.4rem; line-height: 1.7; }
li { margin: .2rem 0; }
p { line-height: 1.6; }
code {
  background: var(--code-bg);
  border-radius: 4px;
  padding: .1em .35em;
  font-size: .9em;
  font-family: "IBM Plex Mono", "Fira Code", monospace;
}
pre { background: var(--code-bg); padding: 1rem; border-radius: 8px; overflow: auto; }
pre code { background: none; padding: 0; }
</style>
</head>
<body>
<main>
  <nav><a href="./">\u2190 Back to reports</a></nav>
  <div id="report">${renderedBody}</div>
</main>
</body>
</html>`;
}

function buildReportsHtml(items, { insideReportsDir = false } = {}) {
  const backLink = insideReportsDir ? "../" : "./";
  const rows = items
    .map((item) => {
      const title = escapeHtml(item.issueTitle || "(untitled)");
      const issueUrl = escapeHtml(item.issueUrl || "");
      let reportPath = escapeHtml(reportHtmlPath(item.reportPath || ""));
      if (insideReportsDir && reportPath.startsWith("reports/")) {
        reportPath = reportPath.slice("reports/".length);
      }
      const runUrl = escapeHtml(item.runUrl || "");
      const createdAt = escapeHtml(item.createdAt || "");

      return `<tr>
<td>${createdAt}</td>
<td><a href="${issueUrl}">#${item.issueNumber}</a></td>
<td>${title}</td>
<td><a href="${reportPath}">View report</a></td>
<td>${runUrl ? `<a href="${runUrl}">Workflow run</a>` : ""}</td>
</tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Open Site Review Reports</title>
<style>
:root {
  --bg: #f4f7f4;
  --surface: #ffffff;
  --ink: #15201d;
  --muted: #5a6b64;
  --line: #d6e2dc;
  --accent: #0b6e4f;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
  background: radial-gradient(circle at 10% 10%, #e7f6ef 0%, var(--bg) 55%);
  color: var(--ink);
}
main {
  max-width: 1040px;
  margin: 2rem auto;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 1.25rem;
  box-shadow: 0 6px 24px rgba(7, 24, 16, 0.08);
}
h1 {
  margin: 0 0 .4rem 0;
  font-size: 1.9rem;
}
p {
  margin: 0 0 1rem 0;
  color: var(--muted);
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: .95rem;
}
th, td {
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
  padding: .65rem .45rem;
}
th {
  color: var(--muted);
  font-weight: 600;
}
a { color: var(--accent); }
@media (max-width: 760px) {
  table, thead, tbody, tr, th, td { display: block; }
  thead { display: none; }
  tr {
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: .5rem;
    margin-bottom: .7rem;
  }
  td { border-bottom: 0; padding: .3rem 0; }
}
</style>
</head>
<body>
<main>
  <h1>Open Site Review Reports</h1>
  <p>Reports generated from issues whose titles begin with SCAN:. <a href="${backLink}">Back to home</a></p>
  <table aria-label="Site review reports">
    <thead>
      <tr>
        <th>Generated</th>
        <th>Issue</th>
        <th>Title</th>
        <th>Report</th>
        <th>Run</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</main>
</body>
</html>`;
}

function main() {
  const pagesDir = process.argv[2];
  const reportPath = process.argv[3];
  if (!pagesDir || !reportPath) {
    throw new Error("Usage: node scripts/update-pages-index.js <pagesDir> <reportPath>");
  }

  fs.mkdirSync(pagesDir, { recursive: true });

  const issueNumber = Number(process.env.ISSUE_NUMBER || "0");
  const issueTitle = process.env.ISSUE_TITLE || "";
  const issueUrl = toAbsoluteUrl(process.env.ISSUE_URL || "");
  const runUrl = toAbsoluteUrl(process.env.RUN_URL || "");
  const createdAt = new Date().toISOString();

  const metadataPath = path.join(pagesDir, "reports.json");
  const entries = readJsonSafe(metadataPath, []);

  entries.unshift({
    issueNumber,
    issueTitle,
    issueUrl,
    runUrl,
    createdAt,
    reportPath
  });

  const deduped = [];
  const seen = new Set();
  for (const entry of entries) {
    const key = `${entry.issueNumber}:${entry.reportPath}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(entry);
  }

  const truncated = deduped.slice(0, 500);
  fs.writeFileSync(metadataPath, JSON.stringify(truncated, null, 2));
  fs.writeFileSync(path.join(pagesDir, "reports.html"), buildReportsHtml(truncated));
  fs.mkdirSync(path.join(pagesDir, "reports"), { recursive: true });
  fs.writeFileSync(path.join(pagesDir, "reports", "index.html"), buildReportsHtml(truncated, { insideReportsDir: true }));

  // Generate HTML companion pages for all .md reports that are missing one.
  for (const entry of truncated) {
    const mdFile = path.join(pagesDir, entry.reportPath);
    const htmlFile = path.join(pagesDir, reportHtmlPath(entry.reportPath));
    if (entry.reportPath.endsWith(".md") && fs.existsSync(mdFile) && !fs.existsSync(htmlFile)) {
      const mdContent = fs.readFileSync(mdFile, "utf8");
      fs.writeFileSync(htmlFile, buildReportHtml(mdContent, entry.issueTitle));
    }
  }
}

main();
