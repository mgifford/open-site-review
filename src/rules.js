const RULES = [
  {
    id: "html-dialog",
    title: "Uses <dialog> element",
    type: "modern-feature",
    sourceType: "html",
    caniuseFeature: "dialog",
    mdnPath: "html.elements.dialog",
    matchRegex: /<dialog\b/i,
    detect: (text) => /<dialog\b/i.test(text),
    whyItMatters:
      "Native dialogs can reduce JavaScript complexity, but may be too new for some target browsers.",
    recommendation:
      "Provide a fallback interaction pattern for unsupported browsers or load a lightweight dialog polyfill conditionally."
  },
  {
    id: "css-has-selector",
    title: "Uses CSS :has() selector",
    type: "modern-feature",
    sourceType: "css",
    caniuseFeature: "css-has",
    mdnPath: "css.selectors.has",
    matchRegex: /:has\(/i,
    detect: (text) => /:has\(/i.test(text),
    whyItMatters:
      ":has() can replace JavaScript-driven parent-state logic, but support can lag in older browsers.",
    recommendation:
      "Keep critical functionality resilient if :has() is unavailable, especially for core navigation and forms."
  },
  {
    id: "js-optional-chaining",
    title: "Uses JavaScript optional chaining",
    type: "modern-feature",
    sourceType: "js",
    caniuseFeature: "mdn-javascript_operators_optional_chaining",
    mdnPath: "javascript.operators.optional_chaining",
    matchRegex: /\?\.(?!\d)/,
    detect: (text) => /\?\.(?!\d)/.test(text),
    whyItMatters:
      "Optional chaining improves readability and safety, but very old browsers require transpilation.",
    recommendation:
      "If older browsers are in scope, transpile this syntax and serve appropriate bundles."
  },
  {
    id: "polyfill-io",
    title: "Loads polyfill.io service",
    type: "polyfill",
    sourceType: "html",
    caniuseFeature: "promises",
    mdnPath: "javascript.builtins.promise",
    matchRegex: /polyfill\.io/i,
    detect: (text) => /polyfill\.io/i.test(text),
    whyItMatters:
      "Broad polyfill payloads can hurt performance and may include features no longer needed by your audience.",
    recommendation:
      "Audit which features are still required for your browser targets and trim or remove unused polyfills."
  },
  {
    id: "core-js-import",
    title: "Imports core-js or babel-polyfill",
    type: "polyfill",
    sourceType: "js",
    caniuseFeature: "es6",
    mdnPath: "javascript",
    matchRegex: /(core-js|babel-polyfill|es5-shim|es6-shim)/i,
    detect: (text) => /(core-js|babel-polyfill|es5-shim|es6-shim)/i.test(text),
    whyItMatters:
      "Global polyfill bundles can increase JS size and execution cost.",
    recommendation:
      "Prefer targeted polyfills and differential serving to reduce bundle cost."
  },
  {
    id: "regenerator-runtime",
    title: "Uses regenerator-runtime",
    type: "polyfill",
    sourceType: "js",
    caniuseFeature: "async-functions",
    mdnPath: "javascript.statements.async_function",
    matchRegex: /regenerator-runtime/i,
    detect: (text) => /regenerator-runtime/i.test(text),
    whyItMatters:
      "Async transpilation runtime may no longer be required for modern browser baselines.",
    recommendation:
      "Re-check browser targets and disable unnecessary async transforms if support is now sufficient."
  },
  {
    id: "jquery-legacy",
    title: "Detects legacy jQuery usage",
    type: "legacy-pattern",
    sourceType: "js",
    caniuseFeature: "queryselector",
    mdnPath: "api.document.queryselector",
    matchRegex: /(\$\(|jQuery\()/i,
    detect: (text) => /(\$\(|jQuery\()/i.test(text),
    whyItMatters:
      "Many DOM tasks historically handled by jQuery are now covered by standard APIs.",
    recommendation:
      "Evaluate whether targeted vanilla replacements can reduce dependency and improve startup performance."
  }
];

module.exports = { RULES };
