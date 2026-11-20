import { useEffect, useState } from "react";
import { parseStationsFile } from "../lib/stations.js";

/**
 * Official station readings published next to the site (data/stations.json, written at deploy
 * time by scripts/fetch-stations.mjs). Resolves to null when the file is missing or invalid,
 * which hides the station panel.
 */
export function useStations(refreshKey = 0) {
  const [data, setData] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    const url = `${import.meta.env.BASE_URL ?? "/"}data/stations.json`;
    Promise.resolve()
      .then(() => fetch(url, { signal: controller.signal, cache: "no-cache" }))
      .then((response) => (response?.ok ? response.json() : null))
      .then((json) => {
        if (!controller.signal.aborted) setData(parseStationsFile(json));
      })
      .catch(() => {
        if (!controller.signal.aborted) setData(null);
      });
    return () => controller.abort();
  }, [refreshKey]);
  return data;
}
