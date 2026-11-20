import { en } from "../i18n/en.js";
import { hi } from "../i18n/hi.js";
import { detectLanguage, makeTranslator } from "../i18n/index.jsx";
import { mr } from "../i18n/mr.js";
import { ACTIVITIES, addHours, bestWindow, getActivity } from "./activities.js";
import { alertTransition, notificationPermission, parseAlertSettings, parseAlertState, showNotification } from "./alerts.js";
import { analyticsConfig, secondsBucket, sectionUrl, track, trackingAllowed } from "./analytics.js";
import { cellSiblings, modelCells, sharedCellGroups } from "./cells.js";
import { drawShareCard, shareFileName, shareSnapshot, shareText, toneColors, wrapLines } from "./shareCard.js";
import {
  concentrationToAqi, distanceKm, isStale, nearestStations, parseOpenAqLocation, parseStationsFile, stationAqi,
} from "./stations.js";
import { parseSurveyState, recordVisit, shouldShowSurvey } from "./survey.js";

/** Hourly points from `startTime`, one per value. */
function points(startTime, values) {
  return values.map((value, index) => ({ time: addHours(startTime, index), value }));
}

describe("identical estimates", () => {
  const areas = [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }];
  // All four report the same cell coordinates, as Open-Meteo does; only A and B match in value.
  const reading = (aqi, hourly = [aqi, aqi]) => ({ latitude: 18.6, longitude: 73.8, current: { us_aqi: aqi, pm2_5: 40 }, hourly: { us_aqi: hourly } });
  const readings = [reading(100), reading(100), reading(100, [100, 101]), {}];

  it("groups areas by identical model output, not by reported coordinates", () => {
    const cells = modelCells(areas, readings);
    expect(cells.cellCount).toBe(2);
    expect(cellSiblings(cells, "A")).toEqual(["B"]);
    expect(cellSiblings(cells, "C")).toEqual([]);
    expect(cellSiblings(cells, "D")).toEqual([]);
    expect(cellSiblings(null, "A")).toEqual([]);
  });

  it("finds selected areas that cannot differ", () => {
    const cells = modelCells(areas, readings);
    expect(sharedCellGroups(cells, ["A", "B", "C"])).toEqual([["A", "B"]]);
    expect(sharedCellGroups(cells, ["A", "C", "D"])).toEqual([]);
    expect(sharedCellGroups(null, ["A", "B"])).toEqual([]);
  });
});

describe("activity windows", () => {
  it("adds hours across midnight and month ends", () => {
    expect(addHours("2026-11-30T23:00", 2)).toBe("2026-12-01T01:00");
  });

  it("falls back to the default activity for unknown ids", () => {
    expect(getActivity("swim").id).toBe("everyone");
    expect(ACTIVITIES.map((activity) => activity.id)).toEqual(["everyone", "run", "kids", "commute"]);
  });

  it("only considers hours inside the activity's time slots", () => {
    // Very clean at 2–4 AM (outside every slot), moderate in the morning.
    const hourly = points("2026-11-20T00:00", [90, 90, 10, 10, 10, 90, 90, 45, 45, 45, 90, 90, 90]);
    const run = bestWindow(hourly, "run");
    expect(run).toMatchObject({ start: "2026-11-20T07:00", end: "2026-11-20T08:00", aqi: 45, meetsLimit: true, limit: 50 });
    expect(run.category.tone).toBe("good");
  });

  it("picks the cleanest window that stays within the limit", () => {
    const hourly = points("2026-11-20T06:00", [80, 80, 80, 60, 60, 60, 120]);
    expect(bestWindow(hourly, "everyone")).toMatchObject({ start: "2026-11-20T09:00", aqi: 60, meetsLimit: true });
  });

  it("returns the cleanest window, flagged, when none meets the limit", () => {
    const hourly = points("2026-11-20T07:00", [130, 110, 125, 140]);
    expect(bestWindow(hourly, "kids")).toMatchObject({ start: "2026-11-20T08:00", aqi: 118, meetsLimit: false });
  });

  it("uses commute slots in the morning and evening only", () => {
    const hourly = points("2026-11-20T10:00", [60, 20, 20, 20, 20, 20, 20, 70, 50, 90]);
    // 11:00–16:00 are cleanest but outside commute hours; 18:00 is the best evening hour.
    expect(bestWindow(hourly, "commute")).toMatchObject({ start: "2026-11-20T18:00", aqi: 50 });
  });

  it("returns null without enough consecutive in-slot hours", () => {
    expect(bestWindow([], "run")).toBeNull();
    expect(bestWindow(points("2026-11-20T22:00", [10, 10, 10]), "everyone")).toBeNull();
    const gap = [{ time: "2026-11-20T07:00", value: 10 }, { time: "2026-11-20T09:00", value: 10 }];
    expect(bestWindow(gap, "kids")).toBeNull();
  });
});

describe("alerts", () => {
  it("parses settings defensively", () => {
    expect(parseAlertSettings(null)).toEqual({ threshold: 100, notify: false });
    expect(parseAlertSettings("{bad")).toEqual({ threshold: 100, notify: false });
    expect(parseAlertSettings(JSON.stringify({ threshold: 999, notify: true }))).toEqual({ threshold: 200, notify: true });
    expect(parseAlertSettings(JSON.stringify({ threshold: "x" }))).toEqual({ threshold: 100, notify: false });
    expect(parseAlertSettings(JSON.stringify({ threshold: 73 })).threshold).toBe(70);
    expect(parseAlertState("[]")).toEqual({});
    expect(parseAlertState("oops")).toEqual({});
  });

  it("fires only on crossings, never on the first reading or after a threshold change", () => {
    const first = alertTransition(undefined, 130, 100);
    expect(first).toEqual({ next: { state: "above", threshold: 100 }, event: null });
    expect(alertTransition(first.next, 140, 100).event).toBeNull();
    expect(alertTransition({ state: "below", threshold: 100 }, 99.6, 100).event).toBe("above"); // rounds to 100
    expect(alertTransition({ state: "above", threshold: 100 }, 60, 100).event).toBe("below");
    expect(alertTransition({ state: "below", threshold: 100 }, 160, 150).event).toBeNull();
    expect(alertTransition({ state: "below", threshold: 100 }, null, 100)).toEqual({ next: { state: "below", threshold: 100 }, event: null });
  });

  it("shows notifications only with permission", () => {
    const Notification = vi.fn();
    Notification.permission = "granted";
    expect(showNotification({ title: "t", body: "b", tag: "x" }, { Notification })).toBe(true);
    expect(Notification).toHaveBeenCalledWith("t", { body: "b", tag: "x" });
    Notification.permission = "denied";
    expect(showNotification({ title: "t" }, { Notification })).toBe(false);
    expect(notificationPermission({})).toBe("unsupported");
    const Throws = vi.fn(() => { throw new TypeError("Illegal constructor"); });
    Throws.permission = "granted";
    expect(showNotification({ title: "t" }, { Notification: Throws })).toBe(false);
  });
});

describe("analytics", () => {
  const nav = { doNotTrack: null };
  const loc = { origin: "https://example.org", pathname: "/airwise/" };

  it("is off without a configured domain", () => {
    expect(analyticsConfig({})).toEqual({ domain: null, endpoint: "https://plausible.io/api/event" });
    const fetchImpl = vi.fn();
    expect(track("pageview", { config: analyticsConfig({}), nav, loc, fetchImpl })).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends a minimal event to a self-hosted endpoint", () => {
    const config = analyticsConfig({ VITE_PLAUSIBLE_DOMAIN: " airwise.example ", VITE_PLAUSIBLE_HOST: "https://stats.example/" });
    const fetchImpl = vi.fn().mockResolvedValue({});
    expect(track("Card shared", { section: "Take action", props: { method: "shared" }, config, nav, loc, fetchImpl })).toBe(true);
    const [endpoint, init] = fetchImpl.mock.calls[0];
    expect(endpoint).toBe("https://stats.example/api/event");
    expect(init).toMatchObject({ method: "POST", keepalive: true, headers: { "Content-Type": "text/plain" } });
    expect(JSON.parse(init.body)).toEqual({
      name: "Card shared", domain: "airwise.example", url: "https://example.org/airwise/take-action", props: { method: "shared" },
    });
  });

  it("honours Do Not Track and Global Privacy Control, and survives fetch errors", () => {
    expect(trackingAllowed({ doNotTrack: "1" })).toBe(false);
    expect(trackingAllowed({ globalPrivacyControl: true })).toBe(false);
    expect(trackingAllowed(null)).toBe(false);
    const config = analyticsConfig({ VITE_PLAUSIBLE_DOMAIN: "a.example" });
    expect(track("x", { config, nav, loc, fetchImpl: () => { throw new Error("blocked"); } })).toBe(false);
    expect(track("x", { config, nav, loc, fetchImpl: () => Promise.reject(new Error("offline")) })).toBe(true);
  });

  it("builds section URLs and buckets durations", () => {
    expect(sectionUrl(undefined, { origin: "https://x.org", pathname: "/" })).toBe("https://x.org/");
    expect(["<3s", "3-5s", "5-10s", "10-20s", "20s+"]).toEqual([1000, 4000, 9000, 15000, 30000].map(secondsBucket));
  });
});

describe("survey", () => {
  it("counts each browser session once", () => {
    expect(recordVisit()).toBe(1);
    expect(recordVisit()).toBe(1);
    sessionStorage.clear();
    expect(recordVisit()).toBe(2);
    expect(recordVisit({ getItem() { throw new Error("blocked"); } }, sessionStorage)).toBe(0);
  });

  it("asks from the third visit, never after an answer, and snoozes for 30 days", () => {
    const now = Date.UTC(2026, 10, 20);
    expect(shouldShowSurvey({}, 2, now)).toBe(false);
    expect(shouldShowSurvey({}, 3, now)).toBe(true);
    expect(shouldShowSurvey({ answer: "very" }, 9, now)).toBe(false);
    expect(shouldShowSurvey({ dismissedAt: now - 5 * 86400000 }, 9, now)).toBe(false);
    expect(shouldShowSurvey({ dismissedAt: now - 31 * 86400000 }, 9, now)).toBe(true);
    expect(parseSurveyState("nope")).toEqual({});
  });
});

describe("stations", () => {
  it("converts particulate concentrations to US AQI", () => {
    expect(concentrationToAqi(0, "pm25")).toBe(0);
    expect(concentrationToAqi(9.04, "pm25")).toBe(50);
    expect(concentrationToAqi(35.4, "pm25")).toBe(100);
    expect(concentrationToAqi(55.5, "pm25")).toBe(151);
    expect(concentrationToAqi(154.9, "pm10")).toBe(100);
    expect(concentrationToAqi(700, "pm10")).toBe(500);
    expect(concentrationToAqi(-1, "pm25")).toBeNull();
    expect(concentrationToAqi(20, "co")).toBeNull();
    expect(stationAqi({ pm25: 40, pm10: 300 })).toEqual({ pollutant: "pm10", aqi: 173 });
    expect(stationAqi({})).toEqual({ aqi: null, pollutant: null });
  });

  it("measures distance and picks the nearest stations with readings", () => {
    const pune = { latitude: 18.5204, longitude: 73.8567 };
    expect(distanceKm(pune, { latitude: 19.076, longitude: 72.8777 })).toBeCloseTo(120, -1);
    const stations = [
      { name: "far", latitude: 19.07, longitude: 72.87, aqi: 50 },
      { name: "near", latitude: 18.53, longitude: 73.85, aqi: 90 },
      { name: "no reading", latitude: 18.52, longitude: 73.85, aqi: null },
      { name: "mid", latitude: 18.6, longitude: 73.8, aqi: 70 },
    ];
    expect(nearestStations(stations, pune).map((station) => station.name)).toEqual(["near", "mid"]);
    expect(nearestStations(stations, pune, { limit: 1 })).toHaveLength(1);
    expect(nearestStations(null, pune)).toEqual([]);
  });

  it("flags stale readings", () => {
    const now = Date.parse("2026-11-20T10:00:00Z");
    expect(isStale({ updatedAt: "2026-11-20T08:00:00Z" }, now)).toBe(false);
    expect(isStale({ updatedAt: "2026-11-20T01:00:00Z" }, now)).toBe(true);
    expect(isStale({}, now)).toBe(true);
  });

  it("parses an OpenAQ location and its latest values", () => {
    const location = {
      id: 7, name: "Karve Road", provider: { name: "AirNow" }, coordinates: { latitude: 18.5, longitude: 73.82 },
      sensors: [
        { id: 1, parameter: { name: "pm25", units: "µg/m³" } },
        { id: 2, parameter: { name: "pm10", units: "µg/m³" } },
        { id: 3, parameter: { name: "co", units: "µg/m³" } },
        { id: 4, parameter: { name: "no2", units: "ppm" } },
      ],
    };
    const latest = [
      { sensorsId: 1, value: 30, datetime: { utc: "2026-11-20T03:00:00Z" } },
      { sensorsId: 1, value: 42, datetime: { utc: "2026-11-20T04:00:00Z" } },
      { sensorsId: 1, value: 10, datetime: { utc: "2026-11-20T02:00:00Z" } },
      { sensorsId: 2, value: -5, datetime: { utc: "2026-11-20T04:00:00Z" } },
      { sensorsId: 3, value: 900, datetime: { utc: "2026-11-20T05:00:00Z" } },
      { sensorsId: 4, value: 0.02, datetime: { utc: "2026-11-20T05:00:00Z" } },
      { sensorsId: 99, value: 1 },
    ];
    expect(parseOpenAqLocation(location, latest)).toEqual({
      id: 7, name: "Karve Road", provider: "AirNow", latitude: 18.5, longitude: 73.82,
      updatedAt: "2026-11-20T04:00:00Z", pm25: 42, pm10: null, no2: null, o3: null, aqi: 117, aqiPollutant: "pm25",
    });
  });

  it("validates the published file", () => {
    expect(parseStationsFile(null)).toBeNull();
    expect(parseStationsFile({ stations: "x" })).toBeNull();
    expect(parseStationsFile({ stations: [{ name: "ok", latitude: 1, longitude: 2 }, { name: "bad" }, null] }).stations).toHaveLength(1);
  });
});

describe("share card", () => {
  const card = {
    title: "Air near Kothrud", date: "Friday, 20 November", aqi: 132, unit: "US AQI", category: "Sensitive groups",
    tone: "sensitive", headline: "Sensitive groups should take it easy", lines: ["Best time outdoors: 7 AM–10 AM · about 62 AQI"],
    footer: "Model estimate, not an official reading", url: "https://example.org/airwise/",
  };

  function fakeContext() {
    const calls = [];
    const record = (name) => (...args) => calls.push([name, ...args]);
    return {
      calls,
      measureText: (text) => ({ width: String(text).length * 20 }),
      fillRect: record("fillRect"), fillText: record("fillText"), beginPath: record("beginPath"), moveTo: record("moveTo"),
      arcTo: record("arcTo"), closePath: record("closePath"), fill: record("fill"),
    };
  }

  it("wraps text to the available width", () => {
    const ctx = { measureText: (text) => ({ width: text.length * 10 }) };
    expect(wrapLines(ctx, "one two three four", 100)).toEqual(["one two", "three four"]);
    expect(wrapLines(ctx, "", 100)).toEqual([]);
    expect(wrapLines(ctx, "supercalifragilistic", 50)).toEqual(["supercalifragilistic"]);
  });

  it("draws every element of the card", () => {
    const ctx = fakeContext();
    drawShareCard(ctx, card);
    const texts = ctx.calls.filter(([name]) => name === "fillText").map(([, text]) => text);
    expect(texts).toEqual(expect.arrayContaining(["airwise.", "Friday, 20 November", "Air near Kothrud", "132", "US AQI"]));
    expect(texts.join(" ")).toContain("Best time outdoors");
    expect(texts.join(" ")).toContain("official reading");
    drawShareCard(fakeContext(), { ...card, aqi: null, tone: "unknown", lines: undefined, brand: undefined, date: undefined });
    expect(toneColors("unknown")).toEqual(toneColors("neutral"));
  });

  it("builds the text summary and a safe file name", () => {
    expect(shareText(card)).toBe([
      "Air near Kothrud: 132 US AQI · Sensitive groups",
      "Sensitive groups should take it easy",
      "Best time outdoors: 7 AM–10 AM · about 62 AQI",
      "Model estimate, not an official reading",
      "https://example.org/airwise/",
    ].join("\n"));
    expect(shareFileName("Air near Koregaon Park")).toBe("airwise-air-near-koregaon-park.png");
    expect(shareFileName("पुणे")).toBe("airwise-air.png");
  });

  it("shares the image where files can be shared", async () => {
    const share = vi.fn().mockResolvedValue();
    const nav = { canShare: () => true, share };
    const result = await shareSnapshot(card, { nav, createBlob: async () => new Blob(["png"], { type: "image/png" }) });
    expect(result).toBe("shared");
    expect(share.mock.calls[0][0].files[0].name).toBe("airwise-air-near-kothrud.png");
  });

  it("downloads the image where file sharing is unsupported", async () => {
    URL.createObjectURL = vi.fn(() => "blob:card");
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const result = await shareSnapshot(card, { nav: {}, createBlob: async () => new Blob(["png"]) });
    expect(result).toBe("downloaded");
    expect(click).toHaveBeenCalled();
  });

  it("falls back to text sharing and reports cancellations and failures", async () => {
    const noImage = async () => null;
    expect(await shareSnapshot(card, { nav: { share: vi.fn().mockResolvedValue() }, createBlob: noImage })).toBe("shared");
    expect(await shareSnapshot(card, { nav: {}, createBlob: noImage })).toBe("unavailable");
    const abort = Object.assign(new Error("cancel"), { name: "AbortError" });
    expect(await shareSnapshot(card, { nav: { share: vi.fn().mockRejectedValue(abort) }, createBlob: noImage })).toBe("cancelled");
    expect(await shareSnapshot(card, { nav: { share: vi.fn().mockRejectedValue(new Error("x")) }, createBlob: noImage })).toBe("failed");
  });
});

describe("i18n", () => {
  it("interpolates placeholders and falls back to English, then to the key", () => {
    const t = makeTranslator("mr");
    expect(t("page.titleArea", { place: "Kothrud" })).toBe("Kothrud जवळील हवा");
    expect(makeTranslator("xx")("nav.forecast")).toBe("Forecast");
    expect(t("missing.key")).toBe("missing.key");
    expect(makeTranslator("en")("best.detail", { start: "7 AM" })).toBe("7 AM–{end} · about {aqi} AQI");
  });

  it("detects a stored or browser language", () => {
    expect(detectLanguage("hi", ["en-US"])).toBe("hi");
    expect(detectLanguage(null, ["fr-FR", "mr-IN"])).toBe("mr");
    expect(detectLanguage("de", ["de-DE"])).toBe("en");
  });

  it("keeps Marathi and Hindi complete, with the same placeholders as English", () => {
    const placeholders = (text) => (text.match(/\{\w+\}/g) ?? []).sort().join();
    for (const dictionary of [mr, hi]) {
      expect(Object.keys(dictionary).sort()).toEqual(Object.keys(en).sort());
      for (const [key, text] of Object.entries(dictionary)) {
        expect([key, placeholders(text)]).toEqual([key, placeholders(en[key])]);
      }
    }
  });
});
