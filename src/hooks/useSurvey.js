import { useCallback, useState } from "react";
import { parseSurveyState, recordVisit, shouldShowSurvey, SURVEY_KEY } from "../lib/survey.js";

function readState() {
  try {
    return parseSurveyState(localStorage.getItem(SURVEY_KEY));
  } catch {
    return {};
  }
}

/**
 * The in-app PMF survey. Only offered when `enabled` (analytics is configured), because an
 * answer that is never recorded would waste the viewer's time.
 */
export function useSurvey({ enabled, onAnswer }) {
  const [visits] = useState(() => recordVisit());
  const [state, setState] = useState(readState);
  const [justAnswered, setJustAnswered] = useState(false);

  const save = useCallback((next) => {
    setState(next);
    try {
      localStorage.setItem(SURVEY_KEY, JSON.stringify(next));
    } catch {
      // The answer is still sent; it may simply be asked again later.
    }
  }, []);

  const answer = useCallback((value) => {
    save({ answer: value, answeredAt: Date.now() });
    setJustAnswered(true);
    onAnswer?.(value);
  }, [onAnswer, save]);

  const dismiss = useCallback(() => save({ ...state, dismissedAt: Date.now() }), [save, state]);

  return {
    visible: Boolean(enabled) && (justAnswered || shouldShowSurvey(state, visits)),
    answered: justAnswered,
    answer,
    dismiss,
  };
}
