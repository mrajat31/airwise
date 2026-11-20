/**
 * Privacy-friendly usage analytics (Plausible-compatible events API).
 *
 * Off unless the site is built with VITE_PLAUSIBLE_DOMAIN. No cookies, no local identifiers,
 * and no locations or place names are sent. Honours Do Not Track and Global Privacy Control.
 */

export function analyticsConfig(env = import.meta.env) {
  const domain = env?.VITE_PLAUSIBLE_DOMAIN?.trim() || null;
  const host = (env?.VITE_PLAUSIBLE_HOST?.trim() || "https://plausible.io").replace(/\/+$/, "");
  return { domain, endpoint: `${host}/api/event` };
}

export function trackingAllowed(nav = globalThis.navigator) {
  if (!nav) return false;
  return !(nav.doNotTrack === "1" || nav.globalPrivacyControl === true);
}

/** Page URL for an app section, e.g. https://host/airwise/forecast. Query strings are dropped. */
export function sectionUrl(section, loc = globalThis.location) {
  const base = `${loc?.origin ?? ""}${(loc?.pathname ?? "/").replace(/\/+$/, "")}`;
  const slug = String(section ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug ? `${base}/${slug}` : `${base}/`;
}

/**
 * Sends one event. Returns true when an event was sent.
 * `props` must only hold coarse, non-identifying values (ids, buckets, language).
 */
export function track(name, { props, section, config = analyticsConfig(), nav = globalThis.navigator, loc = globalThis.location, fetchImpl = globalThis.fetch } = {}) {
  if (!config.domain || !trackingAllowed(nav) || typeof fetchImpl !== "function") return false;
  const body = { name, domain: config.domain, url: sectionUrl(section, loc) };
  if (props && Object.keys(props).length) body.props = props;
  try {
    // text/plain avoids a CORS preflight, as Plausible's own script does.
    Promise.resolve(fetchImpl(config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(body),
      keepalive: true,
    })).catch(() => {});
  } catch {
    return false;
  }
  return true;
}

/** Buckets a duration so no precise timing is sent. */
export function secondsBucket(milliseconds) {
  const seconds = milliseconds / 1000;
  if (seconds < 3) return "<3s";
  if (seconds < 5) return "3-5s";
  if (seconds < 10) return "5-10s";
  if (seconds < 20) return "10-20s";
  return "20s+";
}
