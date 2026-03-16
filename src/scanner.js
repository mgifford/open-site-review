const fs = require("node:fs/promises");
const path = require("node:path");
const fg = require("fast-glob");
const { RULES } = require("./rules");
const { evaluateSupport, getMdnMetadata } = require("./support");
const { fetchSourcesFromUrls } = require("./url-scan");

function classifyFinding(rule, support, config, mdnMetadata) {
  const unsupportedThreshold = config.unsupportedThresholdPercent;
  const removableThreshold = config.removableThresholdPercent;
  const unsupportedValue =
    support.weightedUnsupportedPercent ?? support.unsupportedPercent;

  if (rule.type === "modern-feature") {
    if (unsupportedValue > unsupportedThreshold) {
      return {
        severity: "high",
        kind: "too-new",
        message: `Feature may be too new for target browsers (${unsupportedValue.toFixed(1)}% unsupported).`
      };
    }

    return null;
  }

  if (rule.type === "polyfill") {
    if (unsupportedValue <= removableThreshold) {
      return {
        severity: "medium",
        kind: "possibly-obsolete-polyfill",
        message: `Polyfill likely removable for current targets (${unsupportedValue.toFixed(1)}% unsupported).`
      };
    }

    return {
      severity: "low",
      kind: "polyfill-review",
      message: `Polyfill may still be required for some targets (${unsupportedValue.toFixed(1)}% unsupported).`
    };
  }

  if (rule.type === "legacy-pattern") {
    if (mdnMetadata.deprecated) {
      return {
        severity: "high",
        kind: "deprecated-pattern",
        message: "Legacy pattern relies on a deprecated web platform feature."
      };
    }

    return {
      severity: "low",
      kind: "legacy-modernization-opportunity",
      message: "Pattern has modern native alternatives that may reduce code weight."
    };
  }

  return null;
}

function sourceTypeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html" || ext === ".htm") {
    return "html";
  }

  if (ext === ".css") {
    return "css";
  }

  if (ext === ".js" || ext === ".mjs" || ext === ".cjs") {
    return "js";
  }

  return "unknown";
}

function lineForMatch(text, regex) {
  const match = regex.exec(text);
  if (!match || typeof match.index !== "number") {
    return null;
  }

  const before = text.slice(0, match.index);
  return before.split("\n").length;
}

async function getFilesFromGlobs(globs, ignore) {
  return fg(globs, {
    ignore,
    onlyFiles: true,
    dot: false,
    unique: true
  });
}

async function loadLocalSources(config) {
  const files = await getFilesFromGlobs(config.paths, config.ignore);
  const sources = [];

  for (const filePath of files) {
    const sourceType = sourceTypeFromPath(filePath);
    if (sourceType === "unknown") {
      continue;
    }

    const text = await fs.readFile(filePath, "utf8");
    sources.push({
      location: filePath,
      sourceType,
      text
    });
  }

  return {
    sources,
    scannedFiles: files.length,
    sourceErrors: []
  };
}

async function loadUrlSources(config) {
  const fetched = await fetchSourcesFromUrls(config.urls || [], {
    includeLinkedAssets: config.includeLinkedAssets,
    sameOriginOnly: config.sameOriginOnly
  });

  return {
    sources: fetched.sources,
    scannedFiles: fetched.sources.length,
    sourceErrors: fetched.errors
  };
}

async function scanFiles(config) {
  const sourceMode = config.scanMode || "files";
  const loaded =
    sourceMode === "urls" ? await loadUrlSources(config) : await loadLocalSources(config);
  const findings = [];

  for (const source of loaded.sources) {
    const { location, sourceType, text } = source;

    for (const rule of RULES) {
      if (rule.sourceType !== sourceType) {
        continue;
      }

      const matched = rule.detect(text);
      if (!matched) {
        continue;
      }

      const support = evaluateSupport(rule.caniuseFeature, config.targets, {
        audienceWeights: config.audienceWeights,
        mdnPath: rule.mdnPath
      });
      const mdnMetadata = getMdnMetadata(rule.mdnPath);
      const classification = classifyFinding(rule, support, config, mdnMetadata);

      if (!classification) {
        continue;
      }

      findings.push({
        id: rule.id,
        title: rule.title,
        file: location,
        line: rule.matchRegex ? lineForMatch(text, rule.matchRegex) : null,
        severity: classification.severity,
        kind: classification.kind,
        message: classification.message,
        whyItMatters: rule.whyItMatters,
        recommendation: rule.recommendation,
        caniuseFeature: rule.caniuseFeature || null,
        unsupportedPercent: support.unsupportedPercent,
        weightedUnsupportedPercent: support.weightedUnsupportedPercent,
        unsupportedTargets: support.unsupportedTargets,
        supportError: support.error,
        supportSource: support.source || null,
        mdn: mdnMetadata
      });
    }
  }

  return {
    scannedFiles: loaded.scannedFiles,
    sourceErrors: loaded.sourceErrors,
    findings
  };
}

module.exports = {
  scanFiles
};
