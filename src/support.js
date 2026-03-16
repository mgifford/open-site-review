const browserslist = require("browserslist");
const caniuse = require("caniuse-api");
const bcd = require("@mdn/browser-compat-data");

function getByPath(obj, path) {
  if (!path) {
    return undefined;
  }

  return path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}

function getMdnMetadata(mdnPath) {
  const node = getByPath(bcd, mdnPath);

  if (!node) {
    return { found: false };
  }

  const compat = node.__compat;
  if (!compat) {
    return { found: true };
  }

  const status = compat.status || {};
  return {
    found: true,
    deprecated: Boolean(status.deprecated),
    experimental: Boolean(status.experimental),
    standardTrack: status.standard_track !== false,
    mdnUrl: compat.mdn_url || null,
    specUrl: compat.spec_url || null
  };
}

function evaluateSupport(feature, targetQuery) {
  const targets = browserslist(targetQuery);

  if (!feature) {
    return {
      targets,
      supportedTargets: targets,
      unsupportedTargets: [],
      unsupportedPercent: 0,
      error: null
    };
  }

  const unsupportedTargets = [];

  for (const target of targets) {
    let supported = false;

    try {
      supported = caniuse.isSupported(feature, [target]);
    } catch (error) {
      return {
        targets,
        supportedTargets: [],
        unsupportedTargets: targets,
        unsupportedPercent: 100,
        error: `Unable to evaluate feature '${feature}': ${error.message}`
      };
    }

    if (!supported) {
      unsupportedTargets.push(target);
    }
  }

  const unsupportedPercent =
    targets.length === 0 ? 0 : (unsupportedTargets.length / targets.length) * 100;

  return {
    targets,
    supportedTargets: targets.filter((target) => !unsupportedTargets.includes(target)),
    unsupportedTargets,
    unsupportedPercent,
    error: null
  };
}

module.exports = {
  evaluateSupport,
  getMdnMetadata
};
