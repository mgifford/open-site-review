const browserslist = require("browserslist");
const caniuse = require("caniuse-api");
const bcd = require("@mdn/browser-compat-data");

const BROWSER_TO_BCD = {
  and_chr: "chrome_android",
  and_ff: "firefox_android",
  android: "webview_android",
  chrome: "chrome",
  edge: "edge",
  firefox: "firefox",
  ios_saf: "safari_ios",
  op_mob: "opera_android",
  opera: "opera",
  safari: "safari",
  samsung: "samsunginternet_android"
};

function getByPath(obj, path) {
  if (!path) {
    return undefined;
  }

  return path.split(".").reduce((acc, key) => {
    if (!acc || typeof acc !== "object") {
      return undefined;
    }

    if (Object.prototype.hasOwnProperty.call(acc, key)) {
      return acc[key];
    }

    const normalized = key.toLowerCase();
    const matchedKey = Object.keys(acc).find((candidate) => candidate.toLowerCase() === normalized);
    return matchedKey ? acc[matchedKey] : undefined;
  }, obj);
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

function familyFromTarget(target) {
  return target.split(" ")[0].toLowerCase();
}

function parseMajorVersion(versionValue) {
  if (typeof versionValue === "number") {
    return versionValue;
  }

  if (typeof versionValue !== "string") {
    return null;
  }

  const cleaned = versionValue.replace(/[<>=~\s]/g, "");
  const match = cleaned.match(/\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  return Number(match[0]);
}

function targetVersion(target) {
  const parts = target.split(" ");
  return parseMajorVersion(parts.slice(1).join(" "));
}

function isBcdSupportEntrySupported(supportEntry, version) {
  if (supportEntry === undefined || supportEntry === null) {
    return false;
  }

  if (Array.isArray(supportEntry)) {
    return supportEntry.some((item) => isBcdSupportEntrySupported(item, version));
  }

  if (supportEntry.version_removed) {
    return false;
  }

  if (supportEntry.version_added === false) {
    return false;
  }

  if (supportEntry.version_added === true) {
    return true;
  }

  const added = parseMajorVersion(supportEntry.version_added);
  if (added === null || version === null) {
    return false;
  }

  return version >= added;
}

function evaluateSupportFromMdnPath(mdnPath, targetQuery, options = {}) {
  const targets = browserslist(targetQuery);
  const node = getByPath(bcd, mdnPath);
  const compat = node && node.__compat;
  const supportByBrowser = compat && compat.support;

  if (!supportByBrowser) {
    return {
      targets,
      supportedTargets: [],
      unsupportedTargets: targets,
      unsupportedPercent: 100,
      weightedUnsupportedPercent: weightedUnsupportedPercent(targets, targets, options.audienceWeights),
      error: `Unable to evaluate MDN support for '${mdnPath}'.`
    };
  }

  const unsupportedTargets = [];

  for (const target of targets) {
    const family = familyFromTarget(target);
    const browserKey = BROWSER_TO_BCD[family];
    if (!browserKey) {
      unsupportedTargets.push(target);
      continue;
    }

    const version = targetVersion(target);
    const supportEntry = supportByBrowser[browserKey];
    const supported = isBcdSupportEntrySupported(supportEntry, version);
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
    weightedUnsupportedPercent: weightedUnsupportedPercent(
      targets,
      unsupportedTargets,
      options.audienceWeights
    ),
    error: null,
    source: "mdn-bcd"
  };
}

function normalizeAudienceWeights(weights = {}) {
  if (!weights || typeof weights !== "object") {
    return null;
  }

  const entries = Object.entries(weights)
    .map(([key, value]) => [key.toLowerCase(), Number(value)])
    .filter(([, value]) => Number.isFinite(value) && value > 0);

  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) {
    return null;
  }

  return Object.fromEntries(entries.map(([key, value]) => [key, value / total]));
}

function weightedUnsupportedPercent(targets, unsupportedTargets, audienceWeights) {
  const normalized = normalizeAudienceWeights(audienceWeights);
  if (!normalized) {
    return null;
  }

  const unsupported = new Set(unsupportedTargets);
  let unsupportedWeight = 0;
  let totalWeight = 0;

  for (const target of targets) {
    const family = familyFromTarget(target);
    const weight = normalized[family];
    if (!weight) {
      continue;
    }

    totalWeight += weight;
    if (unsupported.has(target)) {
      unsupportedWeight += weight;
    }
  }

  if (totalWeight === 0) {
    return null;
  }

  return (unsupportedWeight / totalWeight) * 100;
}

function evaluateSupport(feature, targetQuery, options = {}) {
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
      if (options.mdnPath) {
        const fallback = evaluateSupportFromMdnPath(options.mdnPath, targetQuery, options);
        return {
          ...fallback,
          error: `Can I Use feature '${feature}' unavailable; used MDN fallback.`
        };
      }

      return {
        targets,
        supportedTargets: [],
        unsupportedTargets: targets,
        unsupportedPercent: 100,
        weightedUnsupportedPercent: weightedUnsupportedPercent(targets, targets, options.audienceWeights),
        error: `Unable to evaluate feature '${feature}': ${error.message}`
      };
    }

    if (!supported) {
      unsupportedTargets.push(target);
    }
  }

  const unsupportedPercent =
    targets.length === 0 ? 0 : (unsupportedTargets.length / targets.length) * 100;
  const weightedUnsupported = weightedUnsupportedPercent(
    targets,
    unsupportedTargets,
    options.audienceWeights
  );

  return {
    targets,
    supportedTargets: targets.filter((target) => !unsupportedTargets.includes(target)),
    unsupportedTargets,
    unsupportedPercent,
    weightedUnsupportedPercent: weightedUnsupported,
    error: null,
    source: "caniuse"
  };
}

module.exports = {
  evaluateSupport,
  getMdnMetadata
};
