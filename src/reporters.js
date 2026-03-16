function severityRank(severity) {
  if (severity === "high") {
    return 0;
  }

  if (severity === "medium") {
    return 1;
  }

  return 2;
}

function sortFindings(findings) {
  return [...findings].sort((a, b) => {
    const bySeverity = severityRank(a.severity) - severityRank(b.severity);
    if (bySeverity !== 0) {
      return bySeverity;
    }

    return a.file.localeCompare(b.file);
  });
}

function annotationLevel(severity) {
  if (severity === "high") {
    return "error";
  }

  if (severity === "medium") {
    return "warning";
  }

  return "notice";
}

function toGithubAnnotations(findings) {
  return findings
    .map((finding) => {
      const level = annotationLevel(finding.severity);
      const escaped = finding.message.replace(/\r?\n/g, " ");
      const linePart = finding.line ? `,line=${finding.line}` : "";
      return `::${level} file=${finding.file}${linePart},title=${finding.title}::${escaped}`;
    })
    .join("\n");
}

function toMarkdown(report, config, options = {}) {
  const findings = sortFindings(report.findings);

  const lines = [];
  lines.push("# Open Site Review Report");
  lines.push("");
  lines.push(`- Targets: ${config.targets}`);
  lines.push(`- Unsupported threshold: ${config.unsupportedThresholdPercent}%`);
  lines.push(`- Polyfill removable threshold: ${config.removableThresholdPercent}%`);
  lines.push(`- Files scanned: ${report.scannedFiles}`);
  lines.push(`- Findings: ${findings.length}`);
  if (config.scanMode === "urls") {
    lines.push(`- Scan mode: URL crawl (${config.sameOriginOnly ? "same-origin assets only" : "all linked assets"})`);
  }
  if (config.audienceWeights) {
    lines.push(`- Audience weighting: enabled`);
  }
  if (report.sourceErrors && report.sourceErrors.length > 0) {
    lines.push(`- Source fetch errors: ${report.sourceErrors.length}`);
  }
  lines.push("");

  if (report.sourceErrors && report.sourceErrors.length > 0) {
    lines.push("## Source Fetch Errors");
    lines.push("");
    for (const sourceError of report.sourceErrors) {
      lines.push(`- ${sourceError.location}: ${sourceError.message}`);
    }
    lines.push("");
  }

  if (findings.length === 0) {
    lines.push("No findings detected for current rules and targets.");

    if (options.ci) {
      lines.push("");
      lines.push("## GitHub Annotations");
      lines.push("");
      lines.push("```text");
      lines.push("(none)");
      lines.push("```");
      lines.push("");
    }

    return lines.join("\n");
  }

  for (const finding of findings) {
    lines.push(`## [${finding.severity.toUpperCase()}] ${finding.title}`);
    lines.push("");
    lines.push(`- Type: ${finding.kind}`);
    lines.push(`- Location: ${finding.file}${finding.line ? `:${finding.line}` : ""}`);
    lines.push(`- Message: ${finding.message}`);
    lines.push(`- Why it matters: ${finding.whyItMatters}`);
    lines.push(`- Recommendation: ${finding.recommendation}`);

    if (finding.caniuseFeature) {
      lines.push(`- Can I Use feature: ${finding.caniuseFeature}`);
      lines.push(`- Unsupported target share: ${finding.unsupportedPercent.toFixed(1)}%`);
      if (typeof finding.weightedUnsupportedPercent === "number") {
        lines.push(`- Weighted unsupported share: ${finding.weightedUnsupportedPercent.toFixed(1)}%`);
      }
      if (finding.supportSource) {
        lines.push(`- Compatibility source: ${finding.supportSource}`);
      }
      if (finding.supportError) {
        lines.push(`- Compatibility note: ${finding.supportError}`);
      }
    }

    if (finding.unsupportedTargets && finding.unsupportedTargets.length > 0) {
      lines.push(`- Unsupported targets: ${finding.unsupportedTargets.join(", ")}`);
    }

    if (finding.mdn && finding.mdn.mdnUrl) {
      lines.push(`- MDN: ${finding.mdn.mdnUrl}`);
    }

    lines.push("");
  }

  if (options.ci) {
    lines.push("## GitHub Annotations");
    lines.push("");
    lines.push("Annotations emitted to stdout for GitHub Actions parsing.");
    lines.push("");
  }

  return lines.join("\n");
}

module.exports = {
  toMarkdown,
  toGithubAnnotations,
  sortFindings
};
