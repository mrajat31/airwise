/** Plain fixture data, shared by unit tests (Vitest) and end-to-end tests (Playwright). */
/** Model "now" used by every fixture: 20 Nov 2026, 10:00 Asia/Kolkata. */
export const NOW = "2026-11-20T10:00";

function pad(value) {
  return String(value).padStart(2, "0");
}

/** Hourly timestamps for 7 past days + 5 forecast days, like the API returns. */
export function hourlyTimes() {
  const times = [];
  for (let day = 13; day <= 24; day += 1) {
    for (let hour = 0; hour < 24; hour += 1) times.push(`2026-11-${pad(day)}T${pad(hour)}:00`);
  }
  return times;
}

/**
 * A single-location air-quality response. `aqiAt(time, index)` controls the hourly US AQI;
 * by default it is flat at `aqi`.
 */
export function airReading({ latitude = 18.52, longitude = 73.86, aqi = 120, aqiAt, pm25Aqi, pm10Aqi = 42, no2Aqi = 21, o3Aqi = 98 } = {}) {
  const time = hourlyTimes();
  const usAqi = time.map((stamp, index) => (aqiAt ? aqiAt(stamp, index) : aqi));
  return {
    latitude,
    longitude,
    timezone: "Asia/Kolkata",
    utc_offset_seconds: 19800,
    current: {
      time: NOW,
      us_aqi: aqi,
      us_aqi_pm2_5: pm25Aqi ?? aqi,
      us_aqi_pm10: pm10Aqi,
      us_aqi_nitrogen_dioxide: no2Aqi,
      us_aqi_ozone: o3Aqi,
      pm2_5: 47,
      pm10: 50,
      nitrogen_dioxide: 41,
      ozone: 75,
    },
    hourly: {
      time,
      us_aqi: usAqi,
      pm2_5: time.map(() => 47),
      pm10: time.map(() => 50),
      nitrogen_dioxide: time.map(() => 41),
      ozone: time.map(() => 75),
    },
  };
}

export const WEATHER = {
  current: {
    time: NOW,
    temperature_2m: 23.4,
    relative_humidity_2m: 37,
    wind_speed_10m: 7,
    wind_direction_10m: 252,
    weather_code: 0,
  },
};

/** A stations.json document with one Pune monitor (Shivajinagar) and one far away. */
export const STATIONS_FILE = {
  generatedAt: "2026-11-20T04:30:00Z",
  source: "OpenAQ (CPCB)",
  stations: [
    {
      id: 101, name: "Shivajinagar, Pune - IITM", provider: "CPCB", latitude: 18.5300, longitude: 73.8500,
      updatedAt: "2026-11-20T04:00:00Z", pm25: 40.2, pm10: 88, no2: 30, o3: 20, aqi: 112, aqiPollutant: "pm25",
    },
    {
      id: 202, name: "Mumbai - Colaba", provider: "CPCB", latitude: 18.91, longitude: 72.82,
      updatedAt: "2026-11-20T04:00:00Z", pm25: 20, pm10: 50, no2: 10, o3: 10, aqi: 68, aqiPollutant: "pm25",
    },
  ],
};

