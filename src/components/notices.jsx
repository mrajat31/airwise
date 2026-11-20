import { BellRing, MessageCircleQuestion, X } from "lucide-react";
import { useI18n } from "../i18n/index.jsx";
import { SURVEY_ANSWERS } from "../lib/survey.js";

/** In-app banner shown when the reading crosses the viewer's alert level. */
export function AlertBanner({ banner, onDismiss }) {
  const { t } = useI18n();
  if (!banner) return null;
  const above = banner.event === "above";
  return (
    <div className={`notice alert-banner ${above ? "notice-warning" : "notice-info"}`} role="alert">
      <BellRing size={18} aria-hidden="true" />
      <div><span>{t(above ? "alerts.bannerAbove" : "alerts.bannerBelow", banner)}</span></div>
      <button type="button" className="icon-button icon-button-ghost" onClick={onDismiss} aria-label={t("alerts.dismiss")}><X size={16} /></button>
    </div>
  );
}

/** The one-question product–market-fit survey. */
export function SurveyCard({ answered, onAnswer, onDismiss }) {
  const { t } = useI18n();
  return (
    <section className="card survey-card" aria-labelledby="survey-heading">
      <div className="survey-head">
        <MessageCircleQuestion size={20} aria-hidden="true" />
        <div>
          <span className="eyebrow">{t("survey.title")}</span>
          <h2 id="survey-heading">{t("survey.question")}</h2>
        </div>
      </div>
      {answered ? (
        <p role="status" className="survey-thanks">{t("survey.thanks")}</p>
      ) : (
        <>
          <div className="survey-options">
            {SURVEY_ANSWERS.map((answer) => (
              <button key={answer} type="button" className="button button-secondary" onClick={() => onAnswer(answer)}>{t(`survey.${answer}`)}</button>
            ))}
            <button type="button" className="button button-ghost" onClick={onDismiss}>{t("survey.dismiss")}</button>
          </div>
          <p className="muted small">{t("survey.privacy")}</p>
        </>
      )}
    </section>
  );
}
