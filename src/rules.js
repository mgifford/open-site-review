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
    id: "html-details-summary",
    title: "Uses <details>/<summary>",
    type: "modern-feature",
    sourceType: "html",
    caniuseFeature: "details",
    mdnPath: "html.elements.details",
    matchRegex: /<details\b/i,
    detect: (text) => /<details\b/i.test(text),
    whyItMatters:
      "Native disclosure widgets can replace JavaScript accordion code, reducing JS bytes and complexity.",
    recommendation:
      "Prefer native details/summary for simple disclosure UI, with CSS customization and graceful fallback."
  },
  {
    id: "html-popover-api",
    title: "Uses HTML popover attribute",
    type: "modern-feature",
    sourceType: "html",
    caniuseFeature: "mdn-api_htmlelement_popover",
    mdnPath: "html.global_attributes.popover",
    matchRegex: /\spopover(=|\s|>)/i,
    detect: (text) => /\spopover(=|\s|>)/i.test(text),
    whyItMatters:
      "The Popover API can replace custom JavaScript overlay logic, but older browsers may need fallback behavior.",
    recommendation:
      "Use popover for progressive enhancement and keep a robust non-popover interaction path."
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
    id: "css-container-queries",
    title: "Uses CSS container queries",
    type: "modern-feature",
    sourceType: "css",
    caniuseFeature: "css-container-queries",
    mdnPath: "css.at-rules.container",
    matchRegex: /@container\b|container-type\s*:/i,
    detect: (text) => /@container\b|container-type\s*:/i.test(text),
    whyItMatters:
      "Container queries can reduce JavaScript-driven responsive logic and simplify component-level layout behavior.",
    recommendation:
      "Use container queries where possible, but ensure critical layouts remain usable when unsupported."
  },
  {
    id: "css-subgrid",
    title: "Uses CSS subgrid",
    type: "modern-feature",
    sourceType: "css",
    caniuseFeature: "css-subgrid",
    mdnPath: "css.properties.grid-template-columns.subgrid",
    matchRegex: /\bsubgrid\b/i,
    detect: (text) => /\bsubgrid\b/i.test(text),
    whyItMatters:
      "Subgrid improves maintainable layout architecture, but support remains uneven in some browser segments.",
    recommendation:
      "Provide resilient grid fallbacks for critical page structure when subgrid support is absent."
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
    id: "js-nullish-coalescing",
    title: "Uses nullish coalescing operator",
    type: "modern-feature",
    sourceType: "js",
    caniuseFeature: "mdn-javascript_operators_nullish_coalescing",
    mdnPath: "javascript.operators.nullish_coalescing",
    matchRegex: /\?\?(?![=\?])/,
    detect: (text) => /\?\?(?![=\?])/.test(text),
    whyItMatters:
      "Nullish coalescing can simplify defaults while avoiding falsy-value bugs, but legacy browsers need transpilation.",
    recommendation:
      "Transpile this syntax for older browser support or gate usage to modern bundles only."
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
    id: "intersection-observer-polyfill",
    title: "Loads IntersectionObserver polyfill",
    type: "polyfill",
    sourceType: "js",
    caniuseFeature: "intersectionobserver",
    mdnPath: "api.IntersectionObserver",
    matchRegex: /(intersection-observer|intersectionobserver-polyfill)/i,
    detect: (text) => /(intersection-observer|intersectionobserver-polyfill)/i.test(text),
    whyItMatters:
      "IntersectionObserver support is now broad in modern browsers, so blanket polyfilling can be unnecessary.",
    recommendation:
      "Conditionally load this polyfill only for browsers that still lack support."
  },
  {
    id: "resize-observer-polyfill",
    title: "Loads ResizeObserver polyfill",
    type: "polyfill",
    sourceType: "js",
    caniuseFeature: "resizeobserver",
    mdnPath: "api.ResizeObserver",
    matchRegex: /(resize-observer-polyfill|@juggle\/resize-observer)/i,
    detect: (text) => /(resize-observer-polyfill|@juggle\/resize-observer)/i.test(text),
    whyItMatters:
      "ResizeObserver is widely supported, so always-on polyfills can add avoidable JS overhead.",
    recommendation:
      "Move to feature-detected conditional loading and remove unconditional bundles where possible."
  },
  {
    id: "webcomponents-polyfill",
    title: "Loads Web Components polyfill",
    type: "polyfill",
    sourceType: "js",
    caniuseFeature: "custom-elementsv1",
    mdnPath: "api.CustomElementRegistry",
    matchRegex: /webcomponentsjs|@webcomponents\/webcomponentsjs/i,
    detect: (text) => /webcomponentsjs|@webcomponents\/webcomponentsjs/i.test(text),
    whyItMatters:
      "Web Components polyfills are expensive and may no longer be required for modern browser targets.",
    recommendation:
      "Review support needs and only ship Web Components polyfills to unsupported browsers."
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
    mdnPath: "api.Document.querySelector",
    matchRegex: /(\$\(|jQuery\()/i,
    detect: (text) => /(\$\(|jQuery\()/i.test(text),
    whyItMatters:
      "Many DOM tasks historically handled by jQuery are now covered by standard APIs.",
    recommendation:
      "Evaluate whether targeted vanilla replacements can reduce dependency and improve startup performance."
  },
  {
    id: "document-write",
    title: "Uses document.write",
    type: "legacy-pattern",
    sourceType: "js",
    caniuseFeature: "documentwrite",
    mdnPath: "api.Document.write",
    matchRegex: /document\.write\s*\(/i,
    detect: (text) => /document\.write\s*\(/i.test(text),
    whyItMatters:
      "document.write can block parsing, hurt performance, and create maintainability and security risk.",
    recommendation:
      "Replace with DOM APIs or server-side rendering patterns that avoid parser-blocking behavior."
  },
  {
    id: "sync-xhr",
    title: "Uses synchronous XMLHttpRequest",
    type: "legacy-pattern",
    sourceType: "js",
    caniuseFeature: "xmlhttprequest",
    mdnPath: "api.XMLHttpRequest.open",
    matchRegex: /\.open\s*\([^\)]*,\s*[^\)]*,\s*false\s*\)/i,
    detect: (text) => /\.open\s*\([^\)]*,\s*[^\)]*,\s*false\s*\)/i.test(text),
    whyItMatters:
      "Synchronous XHR blocks the main thread and degrades responsiveness and accessibility.",
    recommendation:
      "Move to async fetch/XMLHttpRequest patterns and handle loading states without blocking UI interaction."
  }
];

module.exports = { RULES };
