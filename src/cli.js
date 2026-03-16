#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
const { scanFiles } = require("./scanner");
const { toMarkdown, toGithubAnnotations, sortFindings } = require("./reporters");
const { resolveUrlsFromIssue } = require("./github-issues");

const DEFAULT_CONFIG = {
  scanMode: "files",
  targets: "defaults, not ie <= 11",
  paths: ["**/*.{html,htm,css,js,mjs,cjs}"],
  urls: [],
  issue: null,
  maxUrls: null,
  includeLinkedAssets: true,
  sameOriginOnly: true,
  audienceWeights: null,
  ignore: ["node_modules/**", "dist/**", "build/**", ".git/**"],
  unsupportedThresholdPercent: 10,
  removableThresholdPercent: 5,
  format: "markdown",
  ci: false
};

function parseArgValue(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1 || index + 1 >= argv.length) {
    return null;
  }

  return argv[index + 1];
}

function hasFlag(argv, flag) {
  return argv.includes(flag);
}

function splitGlobList(input) {
  const items = [];
  let current = "";
  let braceDepth = 0;

  for (const char of input) {
    if (char === "{") {
      braceDepth += 1;
    } else if (char === "}" && braceDepth > 0) {
      braceDepth -= 1;
    }

    if (char === "," && braceDepth === 0) {
      if (current.trim()) {
        items.push(current.trim());
      }
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    items.push(current.trim());
  }

  return items;
}

async function loadConfig(cwd, argv) {
  const configPathArg = parseArgValue(argv, "--config");
  const configPath = configPathArg
    ? path.resolve(cwd, configPathArg)
    : path.resolve(cwd, "open-site-review.config.json");

  let fileConfig = {};
  try {
    const file = await fs.readFile(configPath, "utf8");
    fileConfig = JSON.parse(file);
  } catch (error) {
    if (configPathArg) {
      throw new Error(`Could not read config at ${configPath}: ${error.message}`);
    }
  }

  const cliPaths = parseArgValue(argv, "--paths");
  const cliUrls = parseArgValue(argv, "--urls");
  const cliIssue = parseArgValue(argv, "--issue");
  const cliMaxUrls = parseArgValue(argv, "--max-urls");
  const cliTargets = parseArgValue(argv, "--targets");
  const cliFormat = parseArgValue(argv, "--format");
  const cliAudienceWeights = parseArgValue(argv, "--audience-weights");

  const merged = {
    ...DEFAULT_CONFIG,
    ...fileConfig
  };

  if (cliPaths) {
    merged.paths = splitGlobList(cliPaths);
  }

  if (cliUrls) {
    merged.urls = splitGlobList(cliUrls);
    merged.scanMode = "urls";
  }

  if (cliIssue) {
    merged.issue = cliIssue;
  }

  if (cliTargets) {
    merged.targets = cliTargets;
  }

  if (cliFormat) {
    merged.format = cliFormat;
  }

  if (cliAudienceWeights) {
    merged.audienceWeights = JSON.parse(cliAudienceWeights);
  }

  if (hasFlag(argv, "--ci")) {
    merged.ci = true;
  }

  if (hasFlag(argv, "--all-assets")) {
    merged.sameOriginOnly = false;
  }

  if (cliMaxUrls) {
    const value = Number(cliMaxUrls);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error("--max-urls must be a positive number.");
    }
    merged.maxUrls = Math.floor(value);
  }

  if (merged.issue) {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null;
    const resolved = await resolveUrlsFromIssue(merged.issue, token);
    merged.urls = resolved.urls;
    merged.scanMode = "urls";
  }

  if (typeof merged.maxUrls === "number" && merged.maxUrls > 0) {
    merged.urls = merged.urls.slice(0, merged.maxUrls);
  }

  if (merged.scanMode !== "urls") {
    merged.scanMode = "files";
  }

  return merged;
}

function printHelp() {
  console.log(`open-site-review\n
Usage:
  open-site-review [--config path] [--paths glob1,glob2] [--urls url1,url2] [--issue owner/repo#number|issueURL] [--targets "query"] [--format markdown|json|github]\n
Options:
  --config   Path to JSON configuration file.
  --paths    Comma-separated glob patterns to scan.
  --urls     Comma-separated page URLs to scan.
  --issue    Load URLs from a GitHub issue body.
  --max-urls Limit number of URLs scanned (useful for large issue lists).
  --targets  Browserslist query string.
  --format   Report output format.
  --audience-weights JSON object like {"chrome":0.4,"safari":0.3,"firefox":0.2,"edge":0.1}.
  --all-assets Include cross-origin linked JS/CSS assets in URL mode.
  --ci       Emit GitHub Actions style annotations.
  --help     Show this help text.`);
}

async function main() {
  const argv = process.argv.slice(2);
  if (hasFlag(argv, "--help")) {
    printHelp();
    return;
  }

  const cwd = process.cwd();
  const config = await loadConfig(cwd, argv);
  const report = await scanFiles(config);

  if (config.format === "json") {
    console.log(JSON.stringify({ config, report }, null, 2));
    return;
  }

  if (config.format === "github") {
    const sorted = sortFindings(report.findings);
    const annotations = toGithubAnnotations(sorted);
    if (annotations) {
      console.log(annotations);
    }

    console.log(toMarkdown(report, config, { ci: true }));
    return;
  }

  console.log(toMarkdown(report, config, { ci: config.ci }));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
