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

function buildReportsHtml(items) {
  const rows = items
    .map((item) => {
      const title = escapeHtml(item.issueTitle || "(untitled)");
      const issueUrl = escapeHtml(item.issueUrl || "");
      const reportPath = escapeHtml(item.reportPath || "");
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
  <p>Reports generated from issues whose titles begin with Scan:. <a href="./">Back to home</a></p>
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

  fs.writeFileSync(metadataPath, JSON.stringify(deduped.slice(0, 500), null, 2));
  fs.writeFileSync(path.join(pagesDir, "reports.html"), buildReportsHtml(deduped.slice(0, 500)));
}

main();
