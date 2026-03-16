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

function toMarkdown(report, config) {
  const findings = sortFindings(report.findings);

  const lines = [];
  lines.push("# Open Site Review Report");
  lines.push("");
  lines.push(`- Targets: ${config.targets}`);
  lines.push(`- Unsupported threshold: ${config.unsupportedThresholdPercent}%`);
  lines.push(`- Polyfill removable threshold: ${config.removableThresholdPercent}%`);
  lines.push(`- Files scanned: ${report.scannedFiles}`);
  lines.push(`- Findings: ${findings.length}`);
  lines.push("");

  if (findings.length === 0) {
    lines.push("No findings detected for current rules and targets.");
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
    }

    if (finding.unsupportedTargets && finding.unsupportedTargets.length > 0) {
      lines.push(`- Unsupported targets: ${finding.unsupportedTargets.join(", ")}`);
    }

    if (finding.mdn && finding.mdn.mdnUrl) {
      lines.push(`- MDN: ${finding.mdn.mdnUrl}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

module.exports = {
  toMarkdown
};
