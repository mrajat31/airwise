import { airReading, STATIONS_FILE, WEATHER } from "../src/test/data.js";

/** 20 Nov 2026, 10:15 in Pune: just after the fixtures' model time of 10:00. */
export const FIXED_NOW = new Date("2026-11-20T04:45:00Z");

/** Clean air (around 40) from 6 to 8 AM, 125 at other hours, so every preset has something to rank. */
function aqiAt(time) {
  const hour = Number(time.slice(11, 13));
  return hour >= 6 && hour < 8 ? 40 : 125;
}

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

/**
 * Freezes the clock and answers every external request the app makes with fixture data.
 * Anything unexpected is aborted, so a test can never depend on a live service.
 */
export async function mockNetwork(page, { stations = STATIONS_FILE } = {}) {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
  await page.route("https://air-quality-api.open-meteo.com/**", (route) => {
    const url = new URL(route.request().url());
    const latitudes = url.searchParams.get("latitude").split(",").map(Number);
    const longitudes = url.searchParams.get("longitude").split(",").map(Number);
    const readings = latitudes.map((latitude, index) => airReading({ latitude, longitude: longitudes[index], aqi: 125, aqiAt }));
    return json(route, readings.length === 1 ? readings[0] : readings);
  });
  await page.route("https://api.open-meteo.com/**", (route) => json(route, WEATHER));
  await page.route("**/data/stations.json", (route) => (stations ? json(route, stations) : route.fulfill({ status: 404 })));
}

/** The visible main navigation: the sidebar on wide screens, the tab bar on phones. */
export function mainNav(page) {
  return page.locator('nav[aria-label="Main"]:visible');
}
