import {
  aggregateAreaReadings,
  aqiCategory,
  aqiScalePosition,
  fetchAirQuality,
  fetchAreaAirQuality,
  PUNE_AREAS,
  reverseGeocode,
  weatherDescription,
} from "./airQuality.js";
import { airReading, mockOpenMeteo } from "./test/fixtures.js";

describe("aqiCategory", () => {
  it.each([
    [0, "Good", "good"],
    [50, "Good", "good"],
    [51, "Moderate", "moderate"],
    [100, "Moderate", "moderate"],
    [101, "Sensitive groups", "sensitive"],
    [150, "Sensitive groups", "sensitive"],
    [151, "Unhealthy", "unhealthy"],
    [201, "Very unhealthy", "very-unhealthy"],
    [301, "Hazardous", "hazardous"],
  ])("categorises %s as %s", (aqi, label, tone) => {
    expect(aqiCategory(aqi)).toEqual({ label, tone });
  });

  it("categorises the rounded value so labels match the displayed number", () => {
    expect(aqiCategory(50.4).label).toBe("Good");
    expect(aqiCategory(50.5).label).toBe("Moderate");
    expect(aqiCategory(100.4).label).toBe("Moderate");
    expect(aqiCategory(100.6).label).toBe("Sensitive groups");
  });

  it.each([undefined, null, Number.NaN, Infinity])("treats %s as unavailable", (value) => {
    expect(aqiCategory(value)).toEqual({ label: "Unavailable", tone: "neutral" });
  });
});

describe("aqiScalePosition", () => {
  it("places category boundaries on equal-width segments", () => {
    expect(aqiScalePosition(0)).toBe(0);
    expect(aqiScalePosition(50)).toBeCloseTo(16.67, 1);
    expect(aqiScalePosition(100)).toBeCloseTo(33.33, 1);
    expect(aqiScalePosition(300)).toBeCloseTo(83.33, 1);
    expect(aqiScalePosition(500)).toBe(100);
  });

  it("interpolates within a segment and clamps out-of-range values", () => {
    expect(aqiScalePosition(125)).toBeCloseTo(41.67, 1);
    expect(aqiScalePosition(-10)).toBe(0);
    expect(aqiScalePosition(900)).toBe(100);
    expect(aqiScalePosition(undefined)).toBeNull();
  });
});

describe("aggregateAreaReadings", () => {
  it("averages unique model grid points only", () => {
    const readings = [
      airReading({ latitude: 18.5, longitude: 73.8, aqi: 100 }),
      airReading({ latitude: 18.5, longitude: 73.8, aqi: 100 }), // same grid cell, counted once
      airReading({ latitude: 18.6, longitude: 73.9, aqi: 141 }),
    ];
    const summary = aggregateAreaReadings(readings);
    expect(summary.areaCount).toBe(3);
    expect(summary.modelGridCount).toBe(2);
    expect(summary.current.us_aqi).toBeCloseTo(120.5);
    expect(summary.hourly.us_aqi[0]).toBeCloseTo(120.5);
    expect(summary.current.time).toBe(readings[0].current.time);
  });

  it("ignores missing values when averaging", () => {
    const first = airReading({ latitude: 1, longitude: 1, aqi: 80 });
    const second = airReading({ latitude: 2, longitude: 2, aqi: 120 });
    second.current.pm10 = null;
    const summary = aggregateAreaReadings([first, second]);
    expect(summary.current.pm10).toBe(50);
  });

  it("rejects empty or incomplete input", () => {
    expect(() => aggregateAreaReadings([])).toThrow(/Complete area readings/);
    expect(() => aggregateAreaReadings([{ latitude: 1, longitude: 1 }])).toThrow(/Complete area readings/);
  });
});

describe("fetchAirQuality", () => {
  it("requests current, hourly and archive data for one location", async () => {
    const { calls } = mockOpenMeteo();
    const reading = await fetchAirQuality({ latitude: 18.5, longitude: 73.8 });
    expect(reading.current.us_aqi).toBe(120);
    const params = calls[0].searchParams;
    expect(params.get("past_days")).toBe("7");
    expect(params.get("forecast_days")).toBe("5");
    expect(params.get("hourly")).toContain("us_aqi");
  });

  it("surfaces provider HTTP errors", async () => {
    mockOpenMeteo({ airFor: () => ({ status: 503 }) });
    await expect(fetchAirQuality({ latitude: 1, longitude: 1 })).rejects.toThrow("Data provider returned 503");
  });

  it("surfaces provider error payloads", async () => {
    mockOpenMeteo({ airFor: () => ({ error: true, reason: "Latitude out of range" }) });
    await expect(fetchAirQuality({ latitude: 1, longitude: 1 })).rejects.toThrow("Latitude out of range");
  });

  it("rejects incomplete readings", async () => {
    mockOpenMeteo({ airFor: () => ({ current: { us_aqi: 10 } }) });
    await expect(fetchAirQuality({ latitude: 1, longitude: 1 })).rejects.toThrow(/incomplete/);
  });
});

describe("fetchAreaAirQuality", () => {
  it("requests all areas in one call without hourly data by default", async () => {
    const { calls } = mockOpenMeteo();
    const readings = await fetchAreaAirQuality(PUNE_AREAS);
    expect(readings).toHaveLength(PUNE_AREAS.length);
    expect(calls).toHaveLength(1);
    expect(calls[0].searchParams.get("hourly")).toBeNull();
  });

  it("rejects when the provider returns fewer readings than areas", async () => {
    mockOpenMeteo({ airFor: (locations) => locations.slice(1).map((location) => airReading(location)) });
    await expect(fetchAreaAirQuality(PUNE_AREAS)).rejects.toThrow(/incomplete readings/);
  });
});

describe("reverseGeocode", () => {
  function stubFetch(handler) {
    vi.stubGlobal("fetch", vi.fn((url) => handler(new URL(String(url)))));
  }
  const ok = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

  it("prefers a Photon locality that differs from the city", async () => {
    stubFetch(() => ok({
      features: [
        { properties: { city: "Pune", locality: "Pune" } },
        { properties: { city: "Pune", suburb: "Baner", state: "Maharashtra", country: "India", street: "Baner Road" } },
      ],
    }));
    await expect(reverseGeocode(18.56, 73.78)).resolves.toEqual({
      label: "Baner, Pune",
      region: "Maharashtra, India",
      street: "Baner Road",
    });
  });

  it("falls back to Nominatim when Photon fails", async () => {
    stubFetch((url) => (url.hostname === "photon.komoot.io"
      ? Promise.reject(new Error("offline"))
      : ok({ address: { city: "Pune", suburb: "Aundh", state: "Maharashtra", country: "India", road: "ITI Road" } })));
    await expect(reverseGeocode(18.56, 73.8)).resolves.toEqual({
      label: "Aundh, Pune",
      region: "Maharashtra, India",
      street: "ITI Road",
    });
  });
});

describe("weatherDescription", () => {
  it.each([[0, "Clear sky"], [2, "Partly cloudy"], [45, "Foggy"], [63, "Rain"], [95, "Thunderstorm"], [999, "Current conditions"]])(
    "describes code %s",
    (code, text) => expect(weatherDescription(code)).toBe(text),
  );
});
