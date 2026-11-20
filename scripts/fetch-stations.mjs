#!/usr/bin/env node
/**
 * Fetches the latest official monitor readings around Pune from OpenAQ (CPCB/MPCB stations)
 * and writes public/data/stations.json, which the site serves next to its pages.
 *
 * Runs at deploy time in GitHub Actions. The API key stays in the OPENAQ_API_KEY repository
 * secret: it is only used here, server-side, and is never written to the built site.
 * Without a key the script exits successfully without writing anything, and the site simply
 * hides the station panel.
 *
 * Usage: OPENAQ_API_KEY=... node scripts/fetch-stations.mjs [output-path]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseOpenAqLocation } from "../src/lib/stations.js";

const API = "https://api.openaq.org/v3";
const PUNE = { latitude: 18.5204, longitude: 73.8567 };
const RADIUS_METRES = 25000; // OpenAQ's maximum.
const OUTPUT = resolve(process.argv[2] ?? "public/data/stations.json");
const MAX_STATIONS = 40;
const RECENT_DAYS = 3;

const apiKey = process.env.OPENAQ_API_KEY?.trim();
if (!apiKey) {
  console.log("OPENAQ_API_KEY is not set; skipping station data. The site will hide the station panel.");
  process.exit(0);
}

async function get(path, params = {}) {
  const url = new URL(`${API}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const response = await fetch(url, { headers: { "X-API-Key": apiKey, Accept: "application/json" } });
  if (!response.ok) throw new Error(`OpenAQ ${url.pathname} returned ${response.status}`);
  return response.json();
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function main() {
  const { results: locations = [] } = await get("/locations", {
    coordinates: `${PUNE.latitude},${PUNE.longitude}`,
    radius: RADIUS_METRES,
    limit: 100,
  });
  const cutoff = Date.now() - RECENT_DAYS * 86400000;
  const candidates = locations
    .filter((location) => !location.isMobile)
    .filter((location) => (location.sensors ?? []).some((sensor) => ["pm25", "pm10"].includes(sensor.parameter?.name)))
    .filter((location) => Date.parse(location.datetimeLast?.utc ?? "") >= cutoff)
    .slice(0, MAX_STATIONS);

  const stations = [];
  for (const location of candidates) {
    try {
      const { results: latest = [] } = await get(`/locations/${location.id}/latest`);
      const station = parseOpenAqLocation(location, latest);
      if (Number.isFinite(station.latitude) && Number.isFinite(station.longitude) && Number.isFinite(station.aqi)) {
        stations.push(station);
      }
    } catch (error) {
      console.warn(`Skipping location ${location.id}: ${error.message}`);
    }
    await sleep(1100); // Stay well inside the free tier's 60 requests per minute.
  }

  const document = {
    generatedAt: new Date().toISOString(),
    source: "OpenAQ (CPCB/MPCB monitors)",
    stations,
  };
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(document, null, 2)}\n`);
  console.log(`Wrote ${stations.length} of ${locations.length} stations to ${OUTPUT}`);
}

main().catch((error) => {
  // Never fail the deploy over station data: the site works without it.
  console.warn(`Station data unavailable: ${error.message}`);
  process.exit(0);
});
