const fs = require("node:fs/promises");
const path = require("node:path");
const fg = require("fast-glob");
const { RULES } = require("./rules");
const { evaluateSupport, getMdnMetadata } = require("./support");

function classifyFinding(rule, support, config, mdnMetadata) {
  const unsupportedThreshold = config.unsupportedThresholdPercent;
  const removableThreshold = config.removableThresholdPercent;

  if (rule.type === "modern-feature") {
    if (support.unsupportedPercent > unsupportedThreshold) {
      return {
        severity: "high",
        kind: "too-new",
        message: `Feature may be too new for target browsers (${support.unsupportedPercent.toFixed(1)}% unsupported).`
      };
    }

    return null;
  }

  if (rule.type === "polyfill") {
    if (support.unsupportedPercent <= removableThreshold) {
      return {
        severity: "medium",
        kind: "possibly-obsolete-polyfill",
        message: `Polyfill likely removable for current targets (${support.unsupportedPercent.toFixed(1)}% unsupported).`
      };
    }

    return {
      severity: "low",
      kind: "polyfill-review",
      message: `Polyfill may still be required for some targets (${support.unsupportedPercent.toFixed(1)}% unsupported).`
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

async function scanFiles(config) {
  const files = await getFilesFromGlobs(config.paths, config.ignore);
  const findings = [];

  for (const filePath of files) {
    const sourceType = sourceTypeFromPath(filePath);
    if (sourceType === "unknown") {
      continue;
    }

    const text = await fs.readFile(filePath, "utf8");

    for (const rule of RULES) {
      if (rule.sourceType !== sourceType) {
        continue;
      }

      const matched = rule.detect(text);
      if (!matched) {
        continue;
      }

      const support = evaluateSupport(rule.caniuseFeature, config.targets);
      const mdnMetadata = getMdnMetadata(rule.mdnPath);
      const classification = classifyFinding(rule, support, config, mdnMetadata);

      if (!classification) {
        continue;
      }

      findings.push({
        id: rule.id,
        title: rule.title,
        file: filePath,
        line: rule.matchRegex ? lineForMatch(text, rule.matchRegex) : null,
        severity: classification.severity,
        kind: classification.kind,
        message: classification.message,
        whyItMatters: rule.whyItMatters,
        recommendation: rule.recommendation,
        caniuseFeature: rule.caniuseFeature || null,
        unsupportedPercent: support.unsupportedPercent,
        unsupportedTargets: support.unsupportedTargets,
        supportError: support.error,
        mdn: mdnMetadata
      });
    }
  }

  return {
    scannedFiles: files.length,
    findings
  };
}

module.exports = {
  scanFiles
};
