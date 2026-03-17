let _analyze = null;
let _calculate = null;

async function loadModules() {
  if (!_analyze) {
    const analyzerModule = await import("@projectwallace/css-analyzer");
    _analyze = analyzerModule.analyze;
  }

  if (!_calculate) {
    const qualityModule = await import("@projectwallace/css-code-quality");
    _calculate = qualityModule.calculate;
  }
}

function extractDesignTokens(analysis) {
  const tokens = {};
  const custom = analysis.properties && analysis.properties.custom;

  if (custom && custom.total > 0) {
    tokens.customProperties = {
      total: custom.total,
      totalUnique: custom.totalUnique,
      unique: custom.unique
    };
  }

  const values = analysis.values || {};

  if (values.colors && values.colors.totalUnique > 0) {
    tokens.colors = {
      total: values.colors.total,
      totalUnique: values.colors.totalUnique,
      unique: values.colors.unique
    };
  }

  if (values.fontFamilies && values.fontFamilies.totalUnique > 0) {
    tokens.fontFamilies = {
      total: values.fontFamilies.total,
      totalUnique: values.fontFamilies.totalUnique,
      unique: values.fontFamilies.unique
    };
  }

  if (values.fontSizes && values.fontSizes.totalUnique > 0) {
    tokens.fontSizes = {
      total: values.fontSizes.total,
      totalUnique: values.fontSizes.totalUnique,
      unique: values.fontSizes.unique
    };
  }

  if (values.zindexes && values.zindexes.totalUnique > 0) {
    tokens.zindexes = {
      total: values.zindexes.total,
      totalUnique: values.zindexes.totalUnique,
      unique: values.zindexes.unique
    };
  }

  return tokens;
}

function extractComplexityMetrics(analysis) {
  const metrics = {};
  const sheet = analysis.stylesheet || {};

  if (typeof sheet.sourceLinesOfCode === "number") {
    metrics.sourceLinesOfCode = sheet.sourceLinesOfCode;
  }

  if (typeof sheet.complexity === "number") {
    metrics.complexity = sheet.complexity;
  }

  const rules = analysis.rules || {};

  if (typeof rules.total === "number") {
    metrics.totalRules = rules.total;
  }

  const selectors = analysis.selectors || {};

  if (typeof selectors.total === "number") {
    metrics.totalSelectors = selectors.total;
  }

  if (selectors.specificity) {
    const maxSpec = selectors.specificity.max;
    if (Array.isArray(maxSpec)) {
      metrics.maxSelectorSpecificity = maxSpec.join(",");
    }
  }

  const declarations = analysis.declarations || {};

  if (typeof declarations.total === "number") {
    metrics.totalDeclarations = declarations.total;
  }

  if (declarations.importants && typeof declarations.importants.total === "number") {
    metrics.importants = declarations.importants.total;
  }

  return metrics;
}

async function analyzeCssQuality(cssText) {
  await loadModules();

  const analysis = _analyze(cssText);
  const quality = _calculate(cssText);

  const designTokens = extractDesignTokens(analysis);
  const complexityMetrics = extractComplexityMetrics(analysis);

  return {
    quality: {
      performance: quality.performance ? quality.performance.score : null,
      maintainability: quality.maintainability ? quality.maintainability.score : null,
      complexity: quality.complexity ? quality.complexity.score : null,
      violations: (quality.violations || []).map((v) => ({
        id: v.id,
        score: v.score
      }))
    },
    designTokens,
    complexityMetrics
  };
}

module.exports = { analyzeCssQuality };
