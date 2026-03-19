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

function extractStatsFromReport(filePath) {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    const filesMatch = text.match(/Files scanned:\s*(\d+)/);
    const findingsMatch = text.match(/Findings:\s*(\d+)/);
    return {
      filesScanned: filesMatch ? Number(filesMatch[1]) : null,
      findingsCount: findingsMatch ? Number(findingsMatch[1]) : null
    };
  } catch {
    return { filesScanned: null, findingsCount: null };
  }
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

function getLatestAndArchive(entries) {
  const seen = new Set();
  const latest = [];
  const archive = [];
  for (const entry of entries) {
    const key = String(entry.issueNumber);
    if (!seen.has(key)) {
      seen.add(key);
      latest.push(entry);
    } else {
      archive.push(entry);
    }
  }
  return { latest, archive };
}

function buildReportsHtml(items, { insideReportsDir = false, isArchive = false, hasArchive = false } = {}) {
  const backLink = insideReportsDir ? "../" : "./";
  const reportsLink = insideReportsDir ? "../reports.html" : "reports.html";
  const archiveLink = insideReportsDir ? "../archive.html" : "archive.html";

  const pageTitle = isArchive ? "Open Site Review \u2014 Archive" : "Open Site Review Reports";
  const heading = isArchive ? "Archived Reports" : "Open Site Review Reports";
  const description = isArchive
    ? "Older scan reports. Each issue may have been scanned more than once; only the most recent scan appears on the current reports page."
    : "Latest reports generated from issues whose titles begin with SCAN:.";

  const archiveNavItem = hasArchive || isArchive
    ? `<a href="${archiveLink}"${isArchive ? ' aria-current="page"' : ' aria-label="View archived reports"'}>Archive</a>`
    : "";

  const rows = items
    .map((item) => {
      const title = escapeHtml(item.issueTitle || "(untitled)");
      const issueUrl = escapeHtml(item.issueUrl || "");
      let reportPath = escapeHtml(reportHtmlPath(item.reportPath || ""));
      if (insideReportsDir && reportPath.startsWith("reports/")) {
        reportPath = reportPath.slice("reports/".length);
      }
      const createdAt = escapeHtml(item.createdAt || "");
      const issueNumber = Number(item.issueNumber) || 0;
      const filesScanned = item.filesScanned != null ? escapeHtml(String(item.filesScanned)) : "";
      const findingsCount = item.findingsCount != null ? escapeHtml(String(item.findingsCount)) : "";

      return `<tr data-issue="${issueNumber}" data-title="${title}" data-date="${createdAt}">
<td><time class="ts-cell" datetime="${createdAt}" title="${createdAt}">${createdAt}</time></td>
<td><a href="${issueUrl}">#${item.issueNumber}</a></td>
<td><a href="${reportPath}">${title}</a></td>
<td>${filesScanned}</td>
<td>${findingsCount}</td>
</tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${pageTitle}</title>
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
.nav { margin-bottom: 1.5rem; padding-bottom: .75rem; border-bottom: 1px solid var(--line); }
.nav a { text-decoration: none; margin-right: 1.5rem; color: var(--accent); font-weight: 600; }
.nav a:hover { text-decoration: underline; }
.table-info { color: var(--muted); font-size: .875rem; margin-top: .75rem; }
time.ts-cell {
  cursor: default;
  border-bottom: 1px dotted var(--muted);
  white-space: nowrap;
}
.pagination-nav {
  display: flex;
  align-items: center;
  gap: .375rem;
  flex-wrap: wrap;
  margin-top: 1.25rem;
}
.page-info { color: var(--muted); font-size: .875rem; margin-right: .5rem; }
.page-btn {
  padding: .375rem .75rem;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  color: var(--accent);
  cursor: pointer;
  font-size: .875rem;
  line-height: 1.4;
}
.page-btn:hover { background: var(--bg); }
.page-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.page-btn-active { background: var(--accent); color: #fff; border-color: var(--accent); }
.page-btn-active:hover { opacity: .88; }
.page-ellipsis { padding: 0 .25rem; color: var(--muted); }
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
  <nav class="nav" aria-label="Site navigation">
    <a href="${backLink}">Submit a scan</a>
    <a href="${reportsLink}"${!isArchive ? ' aria-current="page"' : ""}>${isArchive ? "Latest reports" : "View reports"}</a>
    ${archiveNavItem}
  </nav>
  <h1>${heading}</h1>
  <p>${description}</p>
  <table aria-label="Site review reports">
    <thead>
      <tr>
        <th>Date</th>
        <th>Issue</th>
        <th>Title</th>
        <th>Files</th>
        <th>Findings</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <p class="table-info" id="table-info" aria-live="polite"></p>
  <div id="pagination"></div>
</main>
<script>
(function () {
  var PAGE_SIZE = 25;
  var currentPage = 1;
  var tbody = document.querySelector('tbody');
  var tableEl = document.querySelector('table');
  var paginationEl = document.getElementById('pagination');
  var tableInfoEl = document.getElementById('table-info');
  if (!tbody) return;

  function getRows() {
    return Array.from(tbody.querySelectorAll('tr'));
  }

  function renderPage() {
    var rows = getRows();
    var total = rows.length;
    var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    var start = (currentPage - 1) * PAGE_SIZE;
    var end = start + PAGE_SIZE;
    rows.forEach(function (row, i) {
      row.style.display = (i >= start && i < end) ? '' : 'none';
    });
    if (tableInfoEl) {
      var showing = Math.min(end, total);
      tableInfoEl.textContent = total > 0
        ? 'Showing ' + (start + 1) + ' to ' + showing + ' of ' + total + ' reports'
        : '';
    }
    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    if (!paginationEl) return;
    if (totalPages <= 1) {
      paginationEl.innerHTML = '';
      return;
    }
    var html = '<nav class="pagination-nav" aria-label="Report pages">';
    html += '<span class="page-info">Page ' + currentPage + ' of ' + totalPages + '</span>';
    if (currentPage > 1) {
      html += '<button class="page-btn" data-page="' + (currentPage - 1) + '">Previous</button>';
    }
    var pages = [];
    for (var i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
        pages.push(i);
      }
    }
    var prev = 0;
    pages.forEach(function (page) {
      if (prev && page - prev > 1) {
        html += '<span class="page-ellipsis" aria-hidden="true">\u2026</span>';
      }
      var isActive = page === currentPage;
      html += '<button class="page-btn' + (isActive ? ' page-btn-active' : '') + '" data-page="' + page + '"' +
        ' aria-label="Page ' + page + '"' +
        (isActive ? ' aria-current="page"' : '') + '>' + page + '</button>';
      prev = page;
    });
    if (currentPage < totalPages) {
      html += '<button class="page-btn" data-page="' + (currentPage + 1) + '">Next</button>';
    }
    html += '</nav>';
    paginationEl.innerHTML = html;
    paginationEl.querySelectorAll('.page-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentPage = parseInt(this.dataset.page, 10);
        renderPage();
        if (tableEl) {
          var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          tableEl.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
        }
      });
    });
  }

  renderPage();
}());

// Format dates using the browser's locale; the full ISO timestamp remains in the title tooltip.
(function () {
  document.querySelectorAll('time.ts-cell').forEach(function (el) {
    var iso = el.getAttribute('datetime');
    if (!iso) return;
    var d = new Date(iso);
    if (isNaN(d.getTime())) return;
    el.textContent = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  });
}());
</script>
</body>
</html>`;
}

function writeAllReportPages(pagesDir, entries) {
  const { latest, archive } = getLatestAndArchive(entries);
  const hasArchive = archive.length > 0;
  fs.writeFileSync(path.join(pagesDir, "reports.html"), buildReportsHtml(latest, { hasArchive }));
  fs.writeFileSync(path.join(pagesDir, "archive.html"), buildReportsHtml(archive, { isArchive: true }));
  fs.mkdirSync(path.join(pagesDir, "reports"), { recursive: true });
  fs.writeFileSync(path.join(pagesDir, "reports", "index.html"), buildReportsHtml(latest, { insideReportsDir: true, hasArchive }));
  fs.writeFileSync(path.join(pagesDir, "reports", "archive.html"), buildReportsHtml(archive, { insideReportsDir: true, isArchive: true }));
}

function main() {
  if (process.argv[2] === "--rebuild") {
    const pagesDir = process.argv[3];
    if (!pagesDir) {
      throw new Error("Usage: node scripts/update-pages-index.js --rebuild <pagesDir>");
    }
    const metadataPath = path.join(pagesDir, "reports.json");
    const entries = readJsonSafe(metadataPath, []);
    // Backfill stats from existing HTML/MD report files for entries that lack them.
    for (const entry of entries) {
      if (entry.filesScanned == null || entry.findingsCount == null) {
        const htmlFile = path.join(pagesDir, reportHtmlPath(entry.reportPath));
        const mdFile = path.join(pagesDir, entry.reportPath);
        const candidate = fs.existsSync(htmlFile) ? htmlFile : fs.existsSync(mdFile) ? mdFile : null;
        if (candidate) {
          const stats = extractStatsFromReport(candidate);
          if (entry.filesScanned == null && stats.filesScanned != null) entry.filesScanned = stats.filesScanned;
          if (entry.findingsCount == null && stats.findingsCount != null) entry.findingsCount = stats.findingsCount;
        }
      }
    }
    fs.writeFileSync(metadataPath, JSON.stringify(entries, null, 2));
    fs.writeFileSync(path.join(pagesDir, "reports.html"), buildReportsHtml(entries));
    fs.mkdirSync(path.join(pagesDir, "reports"), { recursive: true });
    fs.writeFileSync(path.join(pagesDir, "reports", "index.html"), buildReportsHtml(entries, { insideReportsDir: true }));
    writeAllReportPages(pagesDir, entries);
    return;
  }

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
  const filesScanned = process.env.FILES_SCANNED ? Number(process.env.FILES_SCANNED) : null;
  const findingsCount = process.env.FINDINGS_COUNT ? Number(process.env.FINDINGS_COUNT) : null;

  const metadataPath = path.join(pagesDir, "reports.json");
  const entries = readJsonSafe(metadataPath, []);

  entries.unshift({
    issueNumber,
    issueTitle,
    issueUrl,
    runUrl,
    createdAt,
    reportPath,
    filesScanned,
    findingsCount
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
  writeAllReportPages(pagesDir, truncated);

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
