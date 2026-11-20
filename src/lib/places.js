export const SAVED_PLACES_KEY = "airwise.savedLocations";

export function locationKey(location) {
  return `${location.latitude.toFixed(5)},${location.longitude.toFixed(5)}`;
}

/** Same id, or the same label/region within ~200 m. */
export function sameSavedPlace(first, second) {
  if (first.id === second.id) return true;
  if (first.label !== second.label || first.region !== second.region) return false;
  const meanLatitude = (first.latitude + second.latitude) / 2;
  const latitudeKm = (first.latitude - second.latitude) * 111;
  const longitudeKm = (first.longitude - second.longitude) * 111 * Math.cos((meanLatitude * Math.PI) / 180);
  return Math.hypot(latitudeKm, longitudeKm) <= 0.2;
}

function isValidPlace(place) {
  return place !== null
    && typeof place === "object"
    && typeof place.id === "string"
    && typeof place.label === "string"
    && Number.isFinite(place.latitude)
    && Number.isFinite(place.longitude);
}

/**
 * Parse the saved-places JSON from local storage. Invalid entries are skipped individually,
 * so one corrupt record no longer discards the whole list. Throws only when the JSON itself
 * is unreadable or is not a list.
 */
export function parseSavedLocations(raw) {
  let saved;
  try {
    saved = JSON.parse(raw || "[]");
  } catch {
    throw new Error("Saved places could not be read from this browser. Check local storage settings.");
  }
  if (!Array.isArray(saved)) {
    throw new Error("Saved places could not be read from this browser. Check local storage settings.");
  }
  const validPlaces = saved.filter(isValidPlace);
  return validPlaces.filter((place, index) =>
    !validPlaces.slice(0, index).some((earlier) => sameSavedPlace(earlier, place)));
}
