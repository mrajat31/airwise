import { airReading, WEATHER } from "./data.js";

export { airReading, hourlyTimes, NOW, STATIONS_FILE, WEATHER } from "./data.js";

function jsonResponse(body, status = 200) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
}

/**
 * fetch() stub for the Open-Meteo endpoints. `airFor(locations)` returns the air-quality body
 * (or a rejected promise / { status } object to simulate failures).
 */
export function mockOpenMeteo({ airFor, weather = WEATHER, stations = null } = {}) {
  const calls = [];
  const fetchMock = vi.fn((input) => {
    const url = new URL(String(input), "http://localhost");
    calls.push(url);
    if (url.pathname.endsWith("/data/stations.json")) return stations ? jsonResponse(stations) : jsonResponse({}, 404);
    if (url.hostname === "air-quality-api.open-meteo.com") {
      const latitudes = url.searchParams.get("latitude").split(",").map(Number);
      const longitudes = url.searchParams.get("longitude").split(",").map(Number);
      const locations = latitudes.map((latitude, index) => ({ latitude, longitude: longitudes[index] }));
      const result = airFor
        ? airFor(locations, url)
        : locations.length === 1
          ? airReading(locations[0])
          : locations.map((location) => airReading(location));
      if (result instanceof Promise) return result;
      if (result?.status) return jsonResponse({}, result.status);
      return jsonResponse(result);
    }
    if (url.hostname === "api.open-meteo.com") return jsonResponse(weather);
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls };
}
