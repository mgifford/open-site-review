#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
const { scanFiles } = require("./scanner");
const { toMarkdown } = require("./reporters");

const DEFAULT_CONFIG = {
  targets: "defaults, not ie <= 11",
  paths: ["**/*.{html,htm,css,js,mjs,cjs}"],
  ignore: ["node_modules/**", "dist/**", "build/**", ".git/**"],
  unsupportedThresholdPercent: 10,
  removableThresholdPercent: 5,
  format: "markdown"
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
  const cliTargets = parseArgValue(argv, "--targets");
  const cliFormat = parseArgValue(argv, "--format");

  const merged = {
    ...DEFAULT_CONFIG,
    ...fileConfig
  };

  if (cliPaths) {
    merged.paths = splitGlobList(cliPaths);
  }

  if (cliTargets) {
    merged.targets = cliTargets;
  }

  if (cliFormat) {
    merged.format = cliFormat;
  }

  return merged;
}

function printHelp() {
  console.log(`open-site-review\n
Usage:
  open-site-review [--config path] [--paths glob1,glob2] [--targets "query"] [--format markdown|json]\n
Options:
  --config   Path to JSON configuration file.
  --paths    Comma-separated glob patterns to scan.
  --targets  Browserslist query string.
  --format   Report output format.
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

  console.log(toMarkdown(report, config));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
