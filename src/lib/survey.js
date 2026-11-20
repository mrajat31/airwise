/** The Sean Ellis product–market-fit question, asked from the third visit onwards. */
export const SURVEY_KEY = "airwise.survey";
export const VISITS_KEY = "airwise.visits";
export const SESSION_FLAG = "airwise.visitCounted";
export const SURVEY_MIN_VISITS = 3;
export const SURVEY_SNOOZE_DAYS = 30;
export const SURVEY_ANSWERS = ["very", "somewhat", "not"];

/** Counts this browser session once and returns the total number of visits. */
export function recordVisit(storage = globalThis.localStorage, session = globalThis.sessionStorage) {
  try {
    const visits = Number(storage.getItem(VISITS_KEY)) || 0;
    if (session.getItem(SESSION_FLAG)) return visits;
    session.setItem(SESSION_FLAG, "1");
    storage.setItem(VISITS_KEY, String(visits + 1));
    return visits + 1;
  } catch {
    return 0;
  }
}

export function parseSurveyState(raw) {
  try {
    const parsed = JSON.parse(raw ?? "null");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function shouldShowSurvey(state, visits, now = Date.now()) {
  if (visits < SURVEY_MIN_VISITS || state?.answer) return false;
  if (Number.isFinite(state?.dismissedAt) && now - state.dismissedAt < SURVEY_SNOOZE_DAYS * 86400000) return false;
  return true;
}
