import { useCallback, useEffect, useRef, useState } from "react";
import {
  ALERT_SETTINGS_KEY,
  ALERT_STATE_KEY,
  alertTransition,
  notificationPermission,
  notificationsSupported,
  parseAlertSettings,
  parseAlertState,
  showNotification,
} from "../lib/alerts.js";
import { roundedAqi } from "../lib/format.js";

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Without storage, alerts still work for this visit.
  }
}

/**
 * Threshold alerts for the selected place. Watches each new reading, shows an in-app banner
 * when it crosses the threshold, and a system notification when the viewer opted in.
 * `describe(event, details)` returns the translated `{ title, body }` for a notification.
 */
export function useAlerts({ placeId, placeLabel, aqi, describe, onEnabled }) {
  const [settings, setSettings] = useState(() => parseAlertSettings(readStorage(ALERT_SETTINGS_KEY)));
  const [permission, setPermission] = useState(() => notificationPermission());
  const [banner, setBanner] = useState(null);
  const latest = useRef({ placeLabel, describe, notify: settings.notify });
  latest.current = { placeLabel, describe, notify: settings.notify };

  useEffect(() => {
    writeStorage(ALERT_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!placeId || roundedAqi(aqi) == null) return;
    const states = parseAlertState(readStorage(ALERT_STATE_KEY));
    const { next, event } = alertTransition(states[placeId], aqi, settings.threshold);
    writeStorage(ALERT_STATE_KEY, JSON.stringify({ ...states, [placeId]: next }));
    if (!event) return;
    const details = { event, place: latest.current.placeLabel, aqi: roundedAqi(aqi), threshold: settings.threshold };
    setBanner(details);
    if (latest.current.notify) {
      const { title, body } = latest.current.describe(event, details);
      showNotification({ title, body, tag: `airwise-${placeId}` });
    }
  }, [placeId, aqi, settings.threshold]);

  const setThreshold = useCallback((threshold) => setSettings((current) => ({ ...current, threshold })), []);

  const enable = useCallback(async () => {
    if (!notificationsSupported()) {
      setPermission("unsupported");
      return;
    }
    let result = window.Notification.permission;
    if (result === "default") {
      try {
        result = await window.Notification.requestPermission();
      } catch {
        result = window.Notification.permission;
      }
    }
    setPermission(result);
    if (result === "granted") {
      setSettings((current) => ({ ...current, notify: true }));
      onEnabled?.();
    }
  }, [onEnabled]);

  const disable = useCallback(() => setSettings((current) => ({ ...current, notify: false })), []);
  const dismissBanner = useCallback(() => setBanner(null), []);

  return { ...settings, permission, setThreshold, enable, disable, banner, dismissBanner };
}
