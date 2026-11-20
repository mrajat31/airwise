import { readingSignature } from "./lib/cells.js";

const AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
const CURRENT_AIR_VARIABLES = "us_aqi,us_aqi_pm2_5,us_aqi_pm10,us_aqi_nitrogen_dioxide,us_aqi_ozone,pm2_5,pm10,nitrogen_dioxide,ozone";
const HOURLY_AIR_VARIABLES = "us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone";

export const PUNE_AREAS = [
  { name: "Kothrud", latitude: 18.5074, longitude: 73.8077 },
  { name: "Shivajinagar", latitude: 18.5308, longitude: 73.8475 },
  { name: "Aundh", latitude: 18.5600, longitude: 73.8070 },
  { name: "Baner", latitude: 18.5590, longitude: 73.7868 },
  { name: "Hadapsar", latitude: 18.5089, longitude: 73.9260 },
  { name: "Koregaon Park", latitude: 18.5362, longitude: 73.8939 },
  { name: "Viman Nagar", latitude: 18.5679, longitude: 73.9143 },
  { name: "Pimpri-Chinchwad", latitude: 18.6298, longitude: 73.7997 },
  { name: "Wakad", latitude: 18.5975, longitude: 73.7622 },
  { name: "Katraj", latitude: 18.4529, longitude: 73.8673 },
  { name: "Warje", latitude: 18.4835, longitude: 73.8077 },
  { name: "Yerawada", latitude: 18.5512, longitude: 73.8797 },
];
export const PUNE_CITY = { name: "Pune city", latitude: 18.5204, longitude: 73.8567 };

async function getJson(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Data provider returned ${response.status}. Please try again shortly.`);
  }
  const data = await response.json();
  if (data.error) {
    throw new Error(data.reason || "The air data provider could not process this location.");
  }
  return data;
}

function airQualityUrl(locations, includeHourly = true) {
  const params = new URLSearchParams({
    latitude: locations.map(({ latitude }) => latitude).join(","),
    longitude: locations.map(({ longitude }) => longitude).join(","),
    current: CURRENT_AIR_VARIABLES,
    timezone: "auto",
  });
  if (includeHourly) {
    params.set("hourly", HOURLY_AIR_VARIABLES);
    params.set("past_days", "7");
    params.set("forecast_days", "5");
  }
  return `${AIR_QUALITY_URL}?${params}`;
}

export async function fetchAirQuality(location, signal) {
  const result = await getJson(airQualityUrl([location]), signal);
  const reading = result.current ? result : result[0];
  if (!reading?.current || !reading?.hourly) {
    throw new Error("The provider returned incomplete air-quality data. Please try again.");
  }
  return reading;
}

export async function fetchAreaAirQuality(areas, signal, includeForecast = false) {
  const result = await getJson(airQualityUrl(areas, includeForecast), signal);
  const readings = Array.isArray(result) ? result : [result];
  if (readings.length !== areas.length || readings.some((reading) => !reading.current)) {
    throw new Error("The provider returned incomplete readings for Pune areas. Please try again.");
  }
  return readings;
}

export function aggregateAreaReadings(readings) {
  if (readings.length === 0 || readings.some((reading) => !reading.current)) {
    throw new Error("Complete area readings are required to calculate a Pune-wide average.");
  }
  // Every area counts once. Readings used to be de-duplicated by the coordinates Open-Meteo
  // returns, but those are coarse cell centres shared by areas with different values, so that
  // silently dropped most areas from the average.
  const average = (values) => {
    const available = values.filter(Number.isFinite);
    return available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : null;
  };
  const currentKeys = [
    "us_aqi",
    "us_aqi_pm2_5",
    "us_aqi_pm10",
    "us_aqi_nitrogen_dioxide",
    "us_aqi_ozone",
    "pm2_5",
    "pm10",
    "nitrogen_dioxide",
    "ozone",
  ];
  const current = Object.fromEntries(currentKeys.map((key) => [
    key,
    average(readings.map((reading) => reading.current[key])),
  ]));
  const timestamps = readings.map((reading) => reading.current.time).sort();
  current.time = timestamps[timestamps.length - 1];
  const hourlyReadings = readings.filter((reading) => reading.hourly?.time);
  const hourly = hourlyReadings.length
    ? {
      time: hourlyReadings[0].hourly.time,
      ...Object.fromEntries(HOURLY_AIR_VARIABLES.split(",").map((key) => [
        key,
        hourlyReadings[0].hourly.time.map((time, index) => {
          const values = hourlyReadings
            .filter((reading) => reading.hourly.time[index] === time)
            .map((reading) => reading.hourly[key]?.[index]);
          return average(values);
        }),
      ])),
    }
    : undefined;
  return {
    latitude: PUNE_CITY.latitude,
    longitude: PUNE_CITY.longitude,
    timezone: readings[0].timezone,
    utc_offset_seconds: readings[0].utc_offset_seconds,
    current,
    hourly,
    areaCount: readings.length,
    distinctEstimates: new Set(readings.map(readingSignature)).size,
  };
}

export async function reverseGeocode(latitude, longitude, signal) {
  const photonParams = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    lang: "en",
    limit: "5",
  });
  try {
    const result = await getJson(`https://photon.komoot.io/reverse?${photonParams}`, signal);
    const candidates = (result.features ?? []).map((feature) => feature.properties).filter(Boolean);
    const place = candidates.find((candidate) => {
      const city = candidate.city || candidate.town || candidate.village;
      const locality = candidate.neighbourhood || candidate.suburb || candidate.locality || candidate.city_district;
      return locality && locality.toLowerCase() !== city?.toLowerCase();
    }) ?? candidates[0];
    if (place) {
      const city = place.city || place.town || place.village;
      const locality = place.neighbourhood || place.suburb || place.locality || place.city_district;
      const distinctLocality = locality && locality.toLowerCase() !== city?.toLowerCase() ? locality : null;
      if (distinctLocality) {
        return {
          label: [distinctLocality, city].filter(Boolean).join(", "),
          region: [place.state, place.country].filter(Boolean).join(", "),
          street: place.street || "",
        };
      }
    }
  } catch (error) {
    if (signal?.aborted) throw error;
  }

  const nominatimParams = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: "jsonv2",
    zoom: "16",
    addressdetails: "1",
  });
  const result = await getJson(`https://nominatim.openstreetmap.org/reverse?${nominatimParams}`, signal);
  const address = result.address ?? {};
  const city = address.city || address.town || address.village || address.municipality;
  const locality = address.neighbourhood || address.city_district || address.residential || address.suburb;
  const distinctLocality = locality && locality.toLowerCase() !== city?.toLowerCase() ? locality : null;
  const region = address.state;
  return {
    label: [distinctLocality, city].filter(Boolean).join(", ") || region || "Nearby location",
    region: [region, address.country].filter(Boolean).join(", "),
    street: address.road || "",
  };
}

export async function fetchWeather(location, signal) {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code",
    timezone: "auto",
  });
  return getJson(`${WEATHER_URL}?${params}`, signal);
}

export function aqiCategory(aqi) {
  if (!Number.isFinite(aqi)) return { label: "Unavailable", tone: "neutral" };
  // Categorise the same rounded value the UI displays, so averaged readings
  // such as 100.4 (shown as 100) are labelled "Moderate", not "Sensitive groups".
  aqi = Math.round(aqi);
  if (aqi <= 50) return { label: "Good", tone: "good" };
  if (aqi <= 100) return { label: "Moderate", tone: "moderate" };
  if (aqi <= 150) return { label: "Sensitive groups", tone: "sensitive" };
  if (aqi <= 200) return { label: "Unhealthy", tone: "unhealthy" };
  if (aqi <= 300) return { label: "Very unhealthy", tone: "very-unhealthy" };
  return { label: "Hazardous", tone: "hazardous" };
}

/** US AQI category boundaries, drawn as equal-width segments on the AQI scale bar. */
export const AQI_BREAKPOINTS = [0, 50, 100, 150, 200, 300, 500];
export const AQI_SCALE_TONES = ["good", "moderate", "sensitive", "unhealthy", "very-unhealthy", "hazardous"];

/** Position (0–100%) of an AQI value on the equal-segment category scale. */
export function aqiScalePosition(aqi) {
  if (!Number.isFinite(aqi)) return null;
  const value = Math.min(Math.max(aqi, 0), 500);
  const segment = Math.max(0, AQI_BREAKPOINTS.findIndex((limit) => value <= limit) - 1);
  const low = AQI_BREAKPOINTS[segment];
  const high = AQI_BREAKPOINTS[segment + 1];
  const segmentWidth = 100 / (AQI_BREAKPOINTS.length - 1);
  return Number((segment * segmentWidth + ((value - low) / (high - low)) * segmentWidth).toFixed(2));
}

export function localTime(value) {
  if (!value) return "Time unavailable";
  const [date, time] = value.split("T");
  return `${time || "—"} · ${date || ""}`;
}

export function weatherDescription(code) {
  if (code === 0) return "Clear sky";
  if ([1, 2, 3].includes(code)) return "Partly cloudy";
  if ([45, 48].includes(code)) return "Foggy";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Current conditions";
}
