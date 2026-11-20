/**
 * Official monitoring stations (CPCB / MPCB, via OpenAQ).
 *
 * Shared by the browser app and scripts/fetch-stations.mjs, so it must stay free of
 * browser-only and Node-only APIs.
 */

// US EPA AQI breakpoints: [low concentration, high concentration, low AQI, high AQI].
// PM2.5 uses the 2024 revision.
const BREAKPOINTS = {
  pm25: [[0, 9.0, 0, 50], [9.1, 35.4, 51, 100], [35.5, 55.4, 101, 150], [55.5, 125.4, 151, 200], [125.5, 225.4, 201, 300], [225.5, 325.4, 301, 500]],
  pm10: [[0, 54, 0, 50], [55, 154, 51, 100], [155, 254, 101, 150], [255, 354, 151, 200], [355, 424, 201, 300], [425, 604, 301, 500]],
};
export const STATION_POLLUTANTS = ["pm25", "pm10", "no2", "o3"];
export const STALE_AFTER_HOURS = 6;

/**
 * US AQI sub-index for a particulate concentration (µg/m³). Stations report short averages,
 * not the 24-hour mean the index is defined on, so the result is an approximation.
 */
export function concentrationToAqi(value, pollutant) {
  const table = BREAKPOINTS[pollutant];
  if (!table || !Number.isFinite(value) || value < 0) return null;
  const truncated = pollutant === "pm25" ? Math.floor(value * 10) / 10 : Math.floor(value);
  const row = table.find(([low, high]) => truncated >= low && truncated <= high);
  if (!row) return 500;
  const [cLow, cHigh, iLow, iHigh] = row;
  return Math.round(((iHigh - iLow) / (cHigh - cLow)) * (truncated - cLow) + iLow);
}

/** The higher of the PM2.5 and PM10 sub-indices, with the pollutant that set it. */
export function stationAqi({ pm25, pm10 } = {}) {
  const candidates = [
    { pollutant: "pm25", aqi: concentrationToAqi(pm25, "pm25") },
    { pollutant: "pm10", aqi: concentrationToAqi(pm10, "pm10") },
  ].filter((candidate) => candidate.aqi != null);
  if (candidates.length === 0) return { aqi: null, pollutant: null };
  return candidates.reduce((highest, candidate) => (candidate.aqi > highest.aqi ? candidate : highest));
}

/** Great-circle distance in kilometres. */
export function distanceKm(a, b) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isStale(station, now = Date.now(), hours = STALE_AFTER_HOURS) {
  const updated = Date.parse(station?.updatedAt ?? "");
  return !Number.isFinite(updated) || now - updated > hours * 3600000;
}

/** Up to `limit` stations with a reading, nearest first, within `maxKm`. */
export function nearestStations(stations, location, { limit = 3, maxKm = 15 } = {}) {
  if (!location || !Array.isArray(stations)) return [];
  return stations
    .filter((station) => Number.isFinite(station.aqi))
    .map((station) => ({ ...station, distanceKm: distanceKm(location, station) }))
    .filter((station) => station.distanceKm <= maxKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

/**
 * Turns an OpenAQ v3 location and its /latest results into a station record.
 * Only values in µg/m³ are kept; the newest timestamp becomes `updatedAt`.
 */
export function parseOpenAqLocation(location, latest = []) {
  const parameterBySensor = new Map((location?.sensors ?? []).map((sensor) => [sensor.id, sensor.parameter]));
  const values = {};
  let updatedAt = null;
  latest.forEach((result) => {
    const parameter = parameterBySensor.get(result.sensorsId);
    if (!parameter || !STATION_POLLUTANTS.includes(parameter.name)) return;
    if (parameter.units && parameter.units !== "µg/m³") return;
    if (!Number.isFinite(result.value) || result.value < 0) return;
    const time = result.datetime?.utc ?? null;
    const previous = values[parameter.name];
    if (previous && previous.time && time && previous.time >= time) return;
    values[parameter.name] = { value: result.value, time };
    if (time && (!updatedAt || time > updatedAt)) updatedAt = time;
  });
  const reading = Object.fromEntries(STATION_POLLUTANTS.map((name) => [name, values[name]?.value ?? null]));
  const { aqi, pollutant } = stationAqi(reading);
  return {
    id: location.id,
    name: location.name,
    provider: location.provider?.name ?? location.owner?.name ?? null,
    latitude: location.coordinates?.latitude,
    longitude: location.coordinates?.longitude,
    updatedAt,
    ...reading,
    aqi,
    aqiPollutant: pollutant,
  };
}

/** Validates the published stations.json. Returns null when it is unusable. */
export function parseStationsFile(data) {
  if (!data || !Array.isArray(data.stations)) return null;
  const stations = data.stations.filter((station) =>
    station && typeof station.name === "string"
    && Number.isFinite(station.latitude) && Number.isFinite(station.longitude));
  return { generatedAt: data.generatedAt ?? null, source: data.source ?? null, stations };
}
