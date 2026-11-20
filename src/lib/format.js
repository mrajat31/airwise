const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-11-20T15:00" -> "3 PM"; "2026-11-20T15:30" -> "3:30 PM". */
export function formatModelHour(value) {
  const [hours = "00", minutes = "00"] = value?.split("T")[1]?.split(":") ?? [];
  const hour = Number(hours);
  return `${hour % 12 || 12}${minutes === "00" ? "" : `:${minutes}`} ${hour < 12 ? "AM" : "PM"}`;
}

/** "2026-11-20T15:00" -> "20 Nov". Parsed by hand so the browser time zone cannot shift the date. */
export function formatModelDate(value) {
  const [year, month, day] = (value ?? "").slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";
  return `${day} ${MONTHS[month - 1]}`;
}

/** "2026-11-20" -> "Fri 20". */
export function formatModelWeekday(value) {
  const [year, month, day] = (value ?? "").slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";
  return `${WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]} ${day}`;
}

/** Axis label for the trend chart: hours for a one-day window, dates for longer ranges. */
export function formatTrendLabel(value, period) {
  return period === "24h" ? formatModelHour(value) : formatModelDate(value);
}

/** Relative age of a model timestamp given in the location's local time. */
export function formatFreshness(localTimestamp, offsetSeconds = 0, now = Date.now()) {
  if (!localTimestamp) return "Update time unavailable";
  const offsetHours = Math.trunc(offsetSeconds / 3600);
  const offsetMinutes = Math.abs(Math.trunc((offsetSeconds % 3600) / 60));
  const sign = offsetSeconds < 0 ? "-" : "+";
  const offset = `${sign}${String(Math.abs(offsetHours)).padStart(2, "0")}:${String(offsetMinutes).padStart(2, "0")}`;
  const updatedAt = new Date(`${localTimestamp}${offset}`);
  if (Number.isNaN(updatedAt.getTime())) return `Model update ${localTimestamp.replace("T", " ")}`;
  const minutes = Math.max(0, Math.floor((now - updatedAt.getTime()) / 60000));
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `Updated ${hours}h ${minutes % 60}m ago` : `Updated ${Math.floor(hours / 24)}d ago`;
}

/** "2026-11-20T15:00" -> "3 PM, 20 Nov". */
export function localTimeShort(value) {
  if (!value) return "unavailable";
  return `${formatModelHour(value)}, ${formatModelDate(value)}`;
}

export function formatNumber(value, digits = 0) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : "—";
}

export function roundedAqi(value) {
  return Number.isFinite(value) ? Math.round(value) : null;
}
