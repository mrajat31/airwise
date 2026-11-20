import { generateAreaActionSuggestions } from "../areaActionPlan.js";
import { airReading, NOW } from "../test/fixtures.js";
import {
  formatFreshness,
  formatModelDate,
  formatModelHour,
  formatModelWeekday,
  formatNumber,
  formatTrendLabel,
  localTimeShort,
} from "./format.js";
import { currentHourIndex, dailyOutlook, forecastOutlook, historySeries, upcomingHours } from "./forecast.js";
import { healthGuidance } from "./health.js";
import { getOverviewInsight, makeRecommendations } from "./insights.js";
import { locationKey, parseSavedLocations, sameSavedPlace } from "./places.js";
import { buildPlanText, planFileName } from "./plan.js";

describe("format", () => {
  it("formats model hours in 12-hour time", () => {
    expect(formatModelHour("2026-11-20T00:00")).toBe("12 AM");
    expect(formatModelHour("2026-11-20T09:00")).toBe("9 AM");
    expect(formatModelHour("2026-11-20T12:00")).toBe("12 PM");
    expect(formatModelHour("2026-11-20T15:30")).toBe("3:30 PM");
  });

  it("formats dates without depending on the browser time zone", () => {
    expect(formatModelDate("2026-11-20T23:00")).toBe("20 Nov");
    expect(formatModelDate("")).toBe("");
    expect(formatModelWeekday("2026-11-20")).toBe("Fri 20");
    expect(localTimeShort("2026-11-20T15:00")).toBe("3 PM, 20 Nov");
    expect(localTimeShort(undefined)).toBe("unavailable");
  });

  it("uses hour labels for the 24-hour trend and dates otherwise", () => {
    expect(formatTrendLabel("2026-11-20T15:00", "24h")).toBe("3 PM");
    expect(formatTrendLabel("2026-11-20T15:00", "7d")).toBe("20 Nov");
  });

  it("describes how old a model timestamp is", () => {
    const now = Date.parse("2026-11-20T10:52:00+05:30");
    expect(formatFreshness("2026-11-20T10:00", 19800, now)).toBe("Updated 52 min ago");
    expect(formatFreshness("2026-11-20T10:52", 19800, now)).toBe("Updated just now");
    expect(formatFreshness("2026-11-20T07:30", 19800, now)).toBe("Updated 3h 22m ago");
    expect(formatFreshness("2026-11-18T10:00", 19800, now)).toBe("Updated 2d ago");
    expect(formatFreshness(undefined)).toBe("Update time unavailable");
  });

  it("handles negative sub-hour UTC offsets", () => {
    const now = Date.parse("2026-11-20T10:30:00Z");
    expect(formatFreshness("2026-11-20T10:00", -1800, now)).toBe("Updated just now");
  });

  it("formats numbers and placeholders", () => {
    expect(formatNumber(4.26, 1)).toBe("4.3");
    expect(formatNumber(null)).toBe("—");
  });
});

describe("forecast", () => {
  const rising = airReading({ aqiAt: (_time, index) => 60 + index });

  it("finds the current hour", () => {
    expect(currentHourIndex(rising.hourly.time, NOW)).toBe(7 * 24 + 10);
    expect(currentHourIndex(rising.hourly.time, undefined)).toBe(-1);
  });

  it("returns upcoming hours starting at the current model hour", () => {
    const hours = upcomingHours(rising.hourly, NOW, 3);
    expect(hours.map((hour) => hour.time)).toEqual(["2026-11-20T10:00", "2026-11-20T11:00", "2026-11-20T12:00"]);
  });

  it("returns nothing when the current time is outside the series", () => {
    expect(upcomingHours(rising.hourly, "2030-01-01T00:00")).toEqual([]);
  });

  it("finds the cleanest 3-hour window and the peak", () => {
    const points = [140, 120, 90, 80, 85, 150, 130].map((value, index) => ({ time: `2026-11-20T${String(10 + index).padStart(2, "0")}:00`, value }));
    const outlook = forecastOutlook(points);
    expect(outlook.cleanWindowTime).toBe("2026-11-20T12:00");
    expect(outlook.cleanWindowAqi).toBe(85);
    expect(outlook.peak).toBe(150);
    expect(outlook.peakTime).toBe("2026-11-20T15:00");
    expect(outlook.peakCategory.label).toBe("Sensitive groups");
    expect(forecastOutlook(points.slice(0, 2))).toBeNull();
  });

  it("groups the remaining hours by day", () => {
    const days = dailyOutlook(rising.hourly, NOW);
    expect(days[0].date).toBe("2026-11-20");
    expect(days).toHaveLength(5);
    expect(days[0].peak).toBeGreaterThan(days[0].average);
  });

  it("samples 24 hours hourly and 7 days every third hour", () => {
    const day = historySeries(rising.hourly, NOW, "us_aqi", "24h");
    expect(day.samples).toHaveLength(25);
    expect(day.samples[day.currentIndex].time).toBe(NOW);
    const week = historySeries(rising.hourly, NOW, "us_aqi", "7d");
    expect(week.samples.length).toBeLessThan(rising.hourly.time.length / 2);
    expect(week.maximum).toBeGreaterThan(150);
  });
});

describe("healthGuidance", () => {
  it.each([[20, "Good day to be outside"], [80, "Fine for most people"], [120, "Sensitive groups should take it easy"], [180, "Limit long outdoor activity"], [250, "Reduce time outdoors"], [400, "Avoid outdoor exertion"]])(
    "gives a headline for AQI %s",
    (aqi, headline) => expect(healthGuidance(aqi).headline).toBe(headline),
  );

  it("uses the rounded value at category boundaries", () => {
    expect(healthGuidance(50.4).headline).toBe("Good day to be outside");
  });

  it("waits when there is no reading", () => {
    expect(healthGuidance(undefined).headline).toBe("Waiting for a reading");
  });
});

describe("insights", () => {
  it("picks the pollutant with the highest sub-index", () => {
    const insight = getOverviewInsight(airReading({ aqi: 90, pm25Aqi: 60, pm10Aqi: 90, o3Aqi: 40 }));
    expect(insight.id).toBe("pm10");
    expect(insight.componentAqi).toBe(90);
    expect(insight.actions.length).toBeGreaterThan(0);
  });

  it("falls back gracefully without pollutant data", () => {
    expect(getOverviewInsight(null).id).toBeNull();
  });

  it("suggests dust and traffic checks above screening triggers", () => {
    const ids = makeRecommendations(airReading()).map((idea) => idea.id);
    expect(ids).toEqual(["dust-check", "traffic-check"]);
  });

  it("suggests routine monitoring when below triggers", () => {
    const clean = airReading();
    Object.assign(clean.current, { pm10: 10, pm2_5: 5, nitrogen_dioxide: 5 });
    expect(makeRecommendations(clean).map((idea) => idea.id)).toEqual(["monitoring-check"]);
    expect(makeRecommendations(null)).toEqual([]);
  });
});

describe("places", () => {
  const place = { id: "a", label: "Home", region: "Pune", latitude: 18.5, longitude: 73.8 };

  it("builds stable location keys", () => {
    expect(locationKey({ latitude: 18.5, longitude: 73.8 })).toBe("18.50000,73.80000");
  });

  it("treats nearby places with the same name as the same place", () => {
    expect(sameSavedPlace(place, { ...place, id: "b", latitude: 18.5005 })).toBe(true);
    expect(sameSavedPlace(place, { ...place, id: "b", latitude: 18.51 })).toBe(false);
    expect(sameSavedPlace(place, { ...place, id: "b", label: "Office" })).toBe(false);
  });

  it("skips invalid entries without discarding valid ones", () => {
    const raw = JSON.stringify([null, 42, { id: 1 }, place, { ...place, id: "dupe" }]);
    expect(parseSavedLocations(raw)).toEqual([place]);
  });

  it("returns an empty list when nothing is stored", () => {
    expect(parseSavedLocations(null)).toEqual([]);
  });

  it("throws a readable error for corrupt storage", () => {
    expect(() => parseSavedLocations("{not json")).toThrow(/could not be read/);
    expect(() => parseSavedLocations("{}")).toThrow(/could not be read/);
  });
});

describe("plan", () => {
  const areaPlan = generateAreaActionSuggestions("Baner", "pm10");
  const plan = { areaLabel: "Baner", currentAqi: 120, targetAqi: 50, signalLabel: "PM10 coarse particles", ...areaPlan };

  it("includes the gap, context, numbered actions and sources", () => {
    const text = buildPlanText(plan, new Date("2026-11-20T06:00:00Z"));
    expect(text).toContain("Airwise area clean-air action plan — Baner");
    expect(text).toContain("20 November 2026");
    expect(text).toContain("70 AQI points separate");
    expect(text).toContain(`Area context — ${areaPlan.context.label}`);
    expect(text).toMatch(/^1\. /m);
    expect(text).toContain("https://prana.cpcb.gov.in/");
  });

  it("notes when the estimate already meets the target", () => {
    expect(buildPlanText({ ...plan, currentAqi: 40 })).toContain("at or below the selected target");
  });

  it("builds a safe file name", () => {
    expect(planFileName("Koregaon Park, Pune")).toBe("airwise-aqi-goal-koregaon-park-pune.txt");
  });
});

describe("generateAreaActionSuggestions", () => {
  it("matches known areas, including reverse-geocoded labels", () => {
    expect(generateAreaActionSuggestions("Kothrud", "pm2_5").context.label).toBe("Residential neighbourhood and busy connectors");
    expect(generateAreaActionSuggestions("Kothrud, Pune", "pm2_5").context.label).toBe("Residential neighbourhood and busy connectors");
  });

  it("uses a cautious local audit for unknown places and removes duplicate actions", () => {
    const result = generateAreaActionSuggestions("Somewhere else", null);
    expect(result.context.label).toBe("Local street and land-use check");
    const ids = result.items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
