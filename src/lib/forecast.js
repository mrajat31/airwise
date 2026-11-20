import { aqiCategory } from "../airQuality.js";

/** Index of the first hourly slot at or after the current model time, or -1. */
export function currentHourIndex(times = [], currentTime) {
  if (!currentTime) return -1;
  return times.findIndex((time) => time >= currentTime);
}

/** Finite hourly values from the current model hour onwards. */
export function upcomingHours(hourly, currentTime, count = 24, key = "us_aqi") {
  const times = hourly?.time ?? [];
  const values = hourly?.[key] ?? [];
  const start = currentHourIndex(times, currentTime);
  if (start < 0) return [];
  return times.slice(start, start + count).flatMap((time, offset) => {
    const value = values[start + offset];
    return Number.isFinite(value) ? [{ time, value }] : [];
  });
}

/**
 * Rule-based 24-hour outlook: the lowest mean 3-hour window and the highest hourly point.
 * Returns null when fewer than three forecast hours are available.
 */
export function forecastOutlook(points) {
  if (!points || points.length < 3) return null;
  const peak = points.reduce((highest, point) => (point.value > highest.value ? point : highest));
  const cleanest = points.slice(0, -2).map((_, index) => {
    const hours = points.slice(index, index + 3);
    return { time: hours[0].time, average: hours.reduce((sum, point) => sum + point.value, 0) / hours.length };
  }).reduce((lowest, item) => (item.average < lowest.average ? item : lowest));
  return {
    peak: Math.round(peak.value),
    peakTime: peak.time,
    peakCategory: aqiCategory(peak.value),
    cleanWindowTime: cleanest.time,
    cleanWindowAqi: Math.round(cleanest.average),
    cleanWindowCategory: aqiCategory(cleanest.average),
  };
}

/** Average and peak US AQI per remaining calendar day. */
export function dailyOutlook(hourly, currentTime) {
  if (!hourly?.time || !currentTime) return [];
  const grouped = new Map();
  hourly.time.forEach((time, index) => {
    const value = hourly.us_aqi?.[index];
    if (time < currentTime || !Number.isFinite(value)) return;
    const date = time.slice(0, 10);
    grouped.set(date, [...(grouped.get(date) ?? []), value]);
  });
  return [...grouped.entries()].map(([date, values]) => ({
    date,
    average: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    peak: Math.round(Math.max(...values)),
  }));
}

/** Samples for the past-archive + forecast trend chart. */
export function historySeries(hourly, currentTime, metric = "us_aqi", period = "7d") {
  const times = hourly?.time ?? [];
  const values = hourly?.[metric] ?? [];
  const nowIndex = currentHourIndex(times, currentTime);
  if (nowIndex < 0) return { samples: [], currentIndex: -1, maximum: 1 };
  const before = period === "24h" ? 12 : 168;
  const after = period === "24h" ? 12 : 120;
  const step = period === "24h" ? 1 : 3;
  const start = Math.max(0, nowIndex - before);
  const end = Math.min(times.length - 1, nowIndex + after);
  const indexes = new Set([nowIndex]);
  for (let index = start; index <= end; index += step) indexes.add(index);
  const samples = [...indexes].sort((a, b) => a - b).flatMap((index) =>
    Number.isFinite(values[index]) ? [{ time: times[index], value: values[index] }] : []);
  return {
    samples,
    currentIndex: samples.findIndex((point) => point.time >= currentTime),
    maximum: Math.max(metric === "us_aqi" ? 150 : 1, ...samples.map(({ value }) => value)) * 1.12,
  };
}
