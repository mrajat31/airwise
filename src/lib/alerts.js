import { roundedAqi } from "./format.js";

export const ALERT_SETTINGS_KEY = "airwise.alerts";
export const ALERT_STATE_KEY = "airwise.alertState";
export const DEFAULT_ALERT_SETTINGS = { threshold: 100, notify: false };
export const THRESHOLD_MIN = 50;
export const THRESHOLD_MAX = 200;

function clampThreshold(value) {
  if (!Number.isFinite(value)) return DEFAULT_ALERT_SETTINGS.threshold;
  return Math.min(THRESHOLD_MAX, Math.max(THRESHOLD_MIN, Math.round(value / 10) * 10));
}

/** Stored alert settings, tolerating missing or corrupt values. */
export function parseAlertSettings(raw) {
  try {
    const parsed = JSON.parse(raw ?? "null");
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_ALERT_SETTINGS };
    return { threshold: clampThreshold(Number(parsed.threshold)), notify: parsed.notify === true };
  } catch {
    return { ...DEFAULT_ALERT_SETTINGS };
  }
}

/** Last known alert state per place: `{ [placeId]: { state: "above" | "below", threshold } }`. */
export function parseAlertState(raw) {
  try {
    const parsed = JSON.parse(raw ?? "null");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Compares a new reading with the place's previous alert state.
 * `event` is "above" when the reading newly reaches the threshold, "below" when it drops
 * back under it, and null otherwise. The first reading for a place (or after the threshold
 * changes) only sets a baseline, so opening the app never fires a notification by itself.
 */
export function alertTransition(previous, aqi, threshold) {
  const rounded = roundedAqi(aqi);
  if (rounded == null) return { next: previous ?? null, event: null };
  const state = rounded >= threshold ? "above" : "below";
  const next = { state, threshold };
  if (!previous || previous.threshold !== threshold || previous.state === state) return { next, event: null };
  return { next, event: state };
}

export function notificationsSupported(win = globalThis) {
  return typeof win.Notification === "function";
}

export function notificationPermission(win = globalThis) {
  return notificationsSupported(win) ? win.Notification.permission : "unsupported";
}

/** Shows a system notification when permission was granted. Returns whether it was shown. */
export function showNotification({ title, body, tag }, win = globalThis) {
  if (notificationPermission(win) !== "granted") return false;
  try {
    new win.Notification(title, { body, tag });
    return true;
  } catch {
    // Some mobile browsers only allow notifications from a service worker.
    return false;
  }
}
