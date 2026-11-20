import { aqiCategory } from "../airQuality.js";

/**
 * Activity presets. Each one ranks forecast windows differently:
 * - `hours`: length of the window the activity needs
 * - `slots`: local hours (start inclusive, end exclusive) the activity realistically happens in
 * - `limit`: the AQI the window should stay at or below
 *
 * Limits follow the US AQI guidance in health.js: strenuous exercise and children's
 * outdoor play aim for "Good" air; everyday plans and commuting aim to stay at "Moderate" or better.
 */
export const ACTIVITIES = [
  { id: "everyone", hours: 3, slots: [[6, 21]], limit: 100 },
  { id: "run", hours: 1, slots: [[5, 20]], limit: 50 },
  { id: "kids", hours: 2, slots: [[7, 19]], limit: 50 },
  { id: "commute", hours: 1, slots: [[7, 11], [17, 21]], limit: 100 },
];

export const DEFAULT_ACTIVITY = "everyone";
export const ACTIVITY_STORAGE_KEY = "airwise.activity";

export function getActivity(id) {
  return ACTIVITIES.find((activity) => activity.id === id) ?? ACTIVITIES[0];
}

function localHour(time) {
  return Number(time?.split("T")[1]?.slice(0, 2));
}

function inSlots(hour, slots) {
  return slots.some(([start, end]) => hour >= start && hour < end);
}

/** "2026-11-20T09:00" plus `hours` -> "2026-11-20T10:00" (clock arithmetic on the model's local time). */
export function addHours(time, hours) {
  const [date, clock = "00:00"] = time.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = clock.split(":").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day, hour + hours, minute));
  const pad = (value) => String(value).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

/**
 * Best upcoming window for an activity over hourly forecast `points` ({ time, value }).
 * A window is a run of consecutive hours that all fall inside the activity's time slots.
 * Returns null when no window fits (for example, too few forecast hours).
 */
export function bestWindow(points, activityId = DEFAULT_ACTIVITY) {
  const activity = getActivity(activityId);
  if (!points?.length) return null;
  const candidates = [];
  for (let start = 0; start + activity.hours <= points.length; start += 1) {
    const hours = points.slice(start, start + activity.hours);
    const consecutive = hours.every((point, offset) => offset === 0 || point.time === addHours(hours[0].time, offset));
    if (!consecutive || !hours.every((point) => inSlots(localHour(point.time), activity.slots))) continue;
    const average = hours.reduce((sum, point) => sum + point.value, 0) / hours.length;
    candidates.push({ start: hours[0].time, average, worst: Math.max(...hours.map((point) => point.value)) });
  }
  if (candidates.length === 0) return null;
  // The cleanest window whose every hour stays within the limit; failing that, the cleanest overall.
  // Ties go to the earliest window.
  const cleanest = (list) => list.reduce((lowest, candidate) => (candidate.average < lowest.average ? candidate : lowest));
  const withinLimit = candidates.filter((candidate) => Math.round(candidate.worst) <= activity.limit);
  const chosen = cleanest(withinLimit.length ? withinLimit : candidates);
  return {
    activity: activity.id,
    start: chosen.start,
    end: addHours(chosen.start, activity.hours),
    hours: activity.hours,
    aqi: Math.round(chosen.average),
    category: aqiCategory(chosen.average),
    limit: activity.limit,
    meetsLimit: withinLimit.length > 0,
  };
}
