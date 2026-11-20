import { useState } from "react";
import { Baby, Bus, Clock, Footprints, MapPin, Share2, Sun, TrendingUp, Users, Wind } from "lucide-react";
import { AQI_BREAKPOINTS, AQI_SCALE_TONES, aqiCategory, aqiScalePosition } from "../airQuality.js";
import { useI18n } from "../i18n/index.jsx";
import { ACTIVITIES } from "../lib/activities.js";
import { formatModelHour, roundedAqi } from "../lib/format.js";
import { POLLUTANTS } from "../lib/insights.js";
import { shareSnapshot } from "../lib/shareCard.js";
import { Pill } from "./ui.jsx";

const ACTIVITY_ICONS = { everyone: Users, run: Footprints, kids: Baby, commute: Bus };

export function AqiScale({ value }) {
  const { t } = useI18n();
  const position = aqiScalePosition(value);
  return (
    <div className="aqi-scale">
      <div className="aqi-scale-track">
        {AQI_SCALE_TONES.map((tone, index) => (
          <span key={tone} className={`tone-${tone}`} title={`${t(`aqi.${tone}`)}: ${AQI_BREAKPOINTS[index] + (index ? 1 : 0)}–${AQI_BREAKPOINTS[index + 1]}`} />
        ))}
        {position != null && <i className="aqi-scale-marker" style={{ left: `${position}%` }} aria-hidden="true" />}
      </div>
      <div className="aqi-scale-labels" aria-hidden="true">
        {AQI_BREAKPOINTS.map((limit) => <span key={limit}>{limit}</span>)}
      </div>
    </div>
  );
}

function HeroStat({ icon: Icon, label, value, detail, tone }) {
  return (
    <div className={`hero-stat ${tone ? `tone-${tone}` : ""}`}>
      <span className="hero-stat-icon"><Icon size={16} aria-hidden="true" /></span>
      <div>
        <span className="hero-stat-label">{label}</span>
        <strong>{value}</strong>
        {detail && <small>{detail}</small>}
      </div>
    </div>
  );
}

/** "Plan for" presets that re-rank the best window. */
export function ActivityPicker({ value, onChange }) {
  const { t } = useI18n();
  return (
    <div className="activity-picker" role="group" aria-label={t("activity.planFor")}>
      <span className="activity-picker-label" aria-hidden="true">{t("activity.planFor")}</span>
      <div className="activity-options">
        {ACTIVITIES.map(({ id }) => {
          const Icon = ACTIVITY_ICONS[id];
          return (
            <button key={id} type="button" aria-pressed={value === id} className={value === id ? "active" : ""} onClick={() => onChange(id)}>
              <Icon size={15} aria-hidden="true" />{t(`activity.${id}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Text for the best-window stat, shared by the hero, the forecast view and the share card. */
export function describeWindow(t, bestTime) {
  if (!bestTime) return null;
  const detail = t("best.detail", { start: formatModelHour(bestTime.start), end: formatModelHour(bestTime.end), aqi: bestTime.aqi });
  return { value: formatModelHour(bestTime.start), detail: bestTime.meetsLimit ? detail : `${detail}. ${t("best.overLimit", { limit: bestTime.limit })}` };
}

function ShareButton({ buildCard, onShared }) {
  const { t } = useI18n();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  async function share() {
    setBusy(true);
    setStatus(null);
    const result = await shareSnapshot(buildCard());
    setBusy(false);
    if (result !== "cancelled") setStatus(result);
    if (["shared", "downloaded", "copied"].includes(result)) onShared?.(result);
  }
  return (
    <div className="hero-share">
      <button type="button" className="button button-on-tone" onClick={share} disabled={busy}>
        <Share2 size={16} aria-hidden="true" />{t(busy ? "share.working" : "share.button")}
      </button>
      <span className="hero-share-status" role="status">{status ? t(`share.${status}`) : ""}</span>
    </div>
  );
}

export function AqiHero({
  air, locationLabel, freshness, outlook, insight, isCitywide, activity, onActivityChange, bestTime,
  sharedWith = [], displayDate, title, onShared,
}) {
  const { t } = useI18n();
  const aqi = air?.current?.us_aqi;
  const rounded = roundedAqi(aqi);
  const category = aqiCategory(aqi);
  const categoryLabel = t(`aqi.${category.tone}`);
  const headline = t(`health.${category.tone}.headline`);
  const leadPollutant = POLLUTANTS.find((pollutant) => pollutant.id === insight?.id);
  const best = describeWindow(t, bestTime);
  const bestLabel = t(`best.${activity}`);

  const buildCard = () => ({
    brand: "airwise.",
    title,
    date: displayDate,
    aqi: rounded,
    unit: t("aqi.unit"),
    category: categoryLabel,
    tone: category.tone,
    headline,
    lines: [
      bestTime && t("share.bestLine", { label: bestLabel, start: formatModelHour(bestTime.start), end: formatModelHour(bestTime.end), aqi: bestTime.aqi }),
      outlook && t("share.peakLine", { time: formatModelHour(outlook.peakTime), aqi: outlook.peak }),
    ].filter(Boolean),
    footer: t("share.footer"),
    url: typeof location === "undefined" ? undefined : `${location.origin}${location.pathname}`,
  });

  return (
    <section className={`hero tone-${category.tone}`} aria-labelledby="hero-heading">
      <div className="hero-main">
        <div className="hero-meta">
          <Pill className="pill-on-tone"><span className="live-dot" aria-hidden="true" />{t("hero.modelEstimate")}</Pill>
          <span><MapPin size={14} aria-hidden="true" />{locationLabel}</span>
          <span><Clock size={14} aria-hidden="true" />{freshness}</span>
        </div>
        <div className="hero-reading">
          <span className="hero-value" aria-hidden="true">{rounded ?? "—"}</span>
          <div className="hero-reading-text">
            <span className="hero-unit">{t("aqi.unit")}</span>
            <span className="hero-category">{categoryLabel}</span>
          </div>
        </div>
        <h2 id="hero-heading" className="hero-headline">
          <span className="visually-hidden">{t("hero.srCurrent", { aqi: rounded ?? t("hero.srUnavailable"), category: categoryLabel })}</span>
          {headline}
        </h2>
        <p className="hero-summary">{t(`health.${category.tone}.summary`)}</p>
        <AqiScale value={aqi} />
        <p className="hero-footnote">
          {isCitywide ? t("hero.footCity", { count: air?.areaCount ?? 12 }) : t("hero.footArea")}
          {sharedWith.length > 0 && <> {t("hero.sharedCell", { areas: [locationLabel, ...sharedWith].join(", ") })}</>}
        </p>
        <ShareButton buildCard={buildCard} onShared={onShared} />
      </div>
      <div className="hero-side" aria-label={t("hero.glance")}>
        <ActivityPicker value={activity} onChange={onActivityChange} />
        <HeroStat
          icon={Sun}
          label={bestLabel}
          value={best?.value ?? "—"}
          detail={best?.detail ?? t("best.unavailable")}
          tone={bestTime?.category.tone}
        />
        <p className="activity-hint">{t(`activity.hint.${activity}`, { limit: bestTime?.limit ?? ACTIVITIES.find((item) => item.id === activity)?.limit })}</p>
        <HeroStat
          icon={TrendingUp}
          label={t("hero.peak")}
          value={outlook ? formatModelHour(outlook.peakTime) : "—"}
          detail={outlook ? t("hero.peakDetail", { aqi: outlook.peak, category: t(`aqi.${outlook.peakCategory.tone}`) }) : t("hero.forecastUnavailable")}
          tone={outlook?.peakCategory.tone}
        />
        <HeroStat
          icon={Wind}
          label={t("hero.mainPollutant")}
          value={leadPollutant?.short ?? "—"}
          detail={Number.isFinite(insight?.componentAqi) ? t("hero.pollutantAqi", { aqi: insight.componentAqi }) : t("common.notAvailable")}
        />
      </div>
    </section>
  );
}
