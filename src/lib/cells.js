/**
 * Areas the model cannot tell apart.
 *
 * Nearby Pune areas often come back from the model with exactly the same numbers. The
 * coordinates Open-Meteo returns are not a reliable way to detect this: it reports the coarse
 * CAMS cell centre (for example 18.6, 73.8 for Aundh, Baner, Wakad and Pimpri-Chinchwad) even
 * when the values differ. So areas are grouped by their actual model output: identical
 * current values and, when present, an identical hourly series.
 */

const CURRENT_KEYS = ["us_aqi", "pm2_5", "pm10", "nitrogen_dioxide", "ozone"];

/** A string that is equal for two readings exactly when their model output is identical. */
export function readingSignature(reading) {
  if (!reading?.current) return null;
  const current = CURRENT_KEYS.map((key) => reading.current[key] ?? "");
  const hourly = reading.hourly?.us_aqi ?? [];
  return JSON.stringify([current, hourly]);
}

/**
 * Groups areas with identical model estimates.
 * Returns `{ cellCount, cells: [{ id, names }], byArea: Map<name, { cell, siblings }> }`,
 * where `cellCount` is the number of distinct estimates.
 */
export function modelCells(areas, readings) {
  const groups = new Map();
  areas.forEach((area, index) => {
    const key = readingSignature(readings?.[index]);
    if (!key) return;
    groups.set(key, [...(groups.get(key) ?? []), area.name]);
  });
  const cells = [...groups.values()].map((names, index) => ({ id: index + 1, names }));
  const byArea = new Map();
  cells.forEach(({ id, names }) => {
    names.forEach((name) => byArea.set(name, { cell: id, siblings: names.filter((other) => other !== name) }));
  });
  return { cellCount: cells.length, cells, byArea };
}

/** Other areas with exactly the same estimate as `name` (empty when unknown or unique). */
export function cellSiblings(cells, name) {
  return cells?.byArea.get(name)?.siblings ?? [];
}

/** Groups of two or more selected areas whose estimates are identical. */
export function sharedCellGroups(cells, names) {
  if (!cells) return [];
  const grouped = new Map();
  names.forEach((name) => {
    const cell = cells.byArea.get(name)?.cell;
    if (cell == null) return;
    grouped.set(cell, [...(grouped.get(cell) ?? []), name]);
  });
  return [...grouped.values()].filter((group) => group.length > 1);
}
