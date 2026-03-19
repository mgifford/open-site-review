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

function formatQualityScore(score) {
  if (typeof score !== "number") {
    return "N/A";
  }

  if (score >= 90) {
    return `${score}/100 ✅`;
  }

  if (score >= 70) {
    return `${score}/100 ⚠️`;
  }

  return `${score}/100 ❌`;
}

function renderCssAnalysis(cssAnalysis, lines) {
  if (!cssAnalysis || cssAnalysis.length === 0) {
    return;
  }

  lines.push("## CSS Quality Analysis");
  lines.push("");
  lines.push(
    "Powered by [Project Wallace](https://www.projectwallace.com/) — " +
      "[css-analyzer](https://github.com/projectwallace/css-analyzer) and " +
      "[css-code-quality](https://github.com/projectwallace/css-code-quality)."
  );
  lines.push("");

  for (const entry of cssAnalysis) {
    lines.push(`### ${entry.file}`);
    lines.push("");

    if (entry.error) {
      lines.push(`- Analysis error: ${entry.error}`);
      lines.push("");
      continue;
    }

    if (entry.quality) {
      lines.push("**Code Quality Scores**");
      lines.push("");
      lines.push(`- Performance: ${formatQualityScore(entry.quality.performance)}`);
      lines.push(`- Maintainability: ${formatQualityScore(entry.quality.maintainability)}`);
      lines.push(`- Complexity: ${formatQualityScore(entry.quality.complexity)}`);

      if (entry.quality.violations && entry.quality.violations.length > 0) {
        lines.push("");
        lines.push("**Quality Violations**");
        lines.push("");
        for (const v of entry.quality.violations) {
          lines.push(`- \`${v.id}\`: score impact ${v.score}`);
        }
      }

      lines.push("");
    }

    if (entry.complexityMetrics && Object.keys(entry.complexityMetrics).length > 0) {
      const m = entry.complexityMetrics;
      lines.push("**Complexity Metrics**");
      lines.push("");
      if (typeof m.sourceLinesOfCode === "number") {
        lines.push(`- Source lines of code: ${m.sourceLinesOfCode}`);
      }

      if (typeof m.complexity === "number") {
        lines.push(`- Stylesheet complexity: ${m.complexity}`);
      }

      if (typeof m.totalRules === "number") {
        lines.push(`- Total rules: ${m.totalRules}`);
      }

      if (typeof m.totalSelectors === "number") {
        lines.push(`- Total selectors: ${m.totalSelectors}`);
      }

      if (typeof m.totalDeclarations === "number") {
        lines.push(`- Total declarations: ${m.totalDeclarations}`);
      }

      if (typeof m.importants === "number" && m.importants > 0) {
        lines.push(`- \`!important\` declarations: ${m.importants}`);
      }

      if (m.maxSelectorSpecificity) {
        lines.push(`- Max selector specificity: ${m.maxSelectorSpecificity}`);
      }

      lines.push("");
    }

    if (entry.designTokens && Object.keys(entry.designTokens).length > 0) {
      const tokens = entry.designTokens;
      lines.push("**Design Tokens**");
      lines.push("");

      if (tokens.customProperties) {
        lines.push(
          `- Custom properties (CSS variables): ${tokens.customProperties.totalUnique} unique`
        );
        const names = Object.keys(tokens.customProperties.unique);
        if (names.length > 0) {
          lines.push(`  - ${names.join(", ")}`);
        }
      }

      if (tokens.colors) {
        lines.push(`- Colors: ${tokens.colors.totalUnique} unique`);
        const colorNames = Object.keys(tokens.colors.unique);
        if (colorNames.length > 0) {
          lines.push(`  - ${colorNames.join(", ")}`);
        }
      }

      if (tokens.fontFamilies) {
        lines.push(`- Font families: ${tokens.fontFamilies.totalUnique} unique`);
        const families = Object.keys(tokens.fontFamilies.unique);
        if (families.length > 0) {
          lines.push(`  - ${families.join(", ")}`);
        }
      }

      if (tokens.fontSizes) {
        lines.push(`- Font sizes: ${tokens.fontSizes.totalUnique} unique`);
        const sizes = Object.keys(tokens.fontSizes.unique);
        if (sizes.length > 0) {
          lines.push(`  - ${sizes.join(", ")}`);
        }
      }

      if (tokens.zindexes) {
        lines.push(`- Z-index values: ${tokens.zindexes.totalUnique} unique`);
        const zvals = Object.keys(tokens.zindexes.unique);
        if (zvals.length > 0) {
          lines.push(`  - ${zvals.join(", ")}`);
        }
      }

      lines.push("");
    }
  }
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
    if (report.scannedFiles === 0 && report.sourceErrors && report.sourceErrors.length > 0) {
      lines.push(`No files were successfully scanned — all ${report.sourceErrors.length} page fetch(es) failed with errors (see "Source Fetch Errors" above).`);
    } else {
      lines.push("No findings detected for current rules and targets.");
    }

    if (options.ci) {
      lines.push("");
      lines.push("## GitHub Annotations");
      lines.push("");
      lines.push("```text");
      lines.push("(none)");
      lines.push("```");
      lines.push("");
    }

    renderCssAnalysis(report.cssAnalysis, lines);

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

  renderCssAnalysis(report.cssAnalysis, lines);

  return lines.join("\n");
}

module.exports = {
  toMarkdown,
  toGithubAnnotations,
  sortFindings
};
