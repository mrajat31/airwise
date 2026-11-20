import { Clock, MapPin, Sun, TrendingUp, Wind } from "lucide-react";
import { AQI_BREAKPOINTS, AQI_SCALE_TONES, aqiCategory, aqiScalePosition } from "../airQuality.js";
import { formatModelHour, roundedAqi } from "../lib/format.js";
import { healthGuidance } from "../lib/health.js";
import { POLLUTANTS } from "../lib/insights.js";
import { Pill } from "./ui.jsx";

const SCALE_LABELS = ["Good", "Moderate", "Sensitive", "Unhealthy", "Very unhealthy", "Hazardous"];

export function AqiScale({ value }) {
  const position = aqiScalePosition(value);
  return (
    <div className="aqi-scale">
      <div className="aqi-scale-track">
        {AQI_SCALE_TONES.map((tone, index) => (
          <span key={tone} className={`tone-${tone}`} title={`${SCALE_LABELS[index]}: ${AQI_BREAKPOINTS[index] + (index ? 1 : 0)}–${AQI_BREAKPOINTS[index + 1]}`} />
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

export function AqiHero({ air, locationLabel, freshness, outlook, insight, isCitywide }) {
  const aqi = air?.current?.us_aqi;
  const category = aqiCategory(aqi);
  const health = healthGuidance(aqi);
  const leadPollutant = POLLUTANTS.find((pollutant) => pollutant.id === insight?.id);

  return (
    <section className={`hero tone-${category.tone}`} aria-labelledby="hero-heading">
      <div className="hero-main">
        <div className="hero-meta">
          <Pill className="pill-on-tone"><span className="live-dot" aria-hidden="true" />Model estimate</Pill>
          <span><MapPin size={14} aria-hidden="true" />{locationLabel}</span>
          <span><Clock size={14} aria-hidden="true" />{freshness}</span>
        </div>
        <div className="hero-reading">
          <span className="hero-value" aria-hidden="true">{roundedAqi(aqi) ?? "—"}</span>
          <div className="hero-reading-text">
            <span className="hero-unit">US AQI</span>
            <span className="hero-category">{category.label}</span>
          </div>
        </div>
        <h2 id="hero-heading" className="hero-headline">
          <span className="visually-hidden">Current air quality: {roundedAqi(aqi) ?? "unavailable"} US AQI, {category.label}. </span>
          {health.headline}
        </h2>
        <p className="hero-summary">{health.summary}</p>
        <AqiScale value={aqi} />
        <p className="hero-footnote">
          {isCitywide
            ? `Average of ${air?.modelGridCount ?? air?.areaCount ?? 12} model points across Pune — not an official city reading.`
            : "Regional model estimate near this place — not a sensor at your exact location."}
        </p>
      </div>
      <div className="hero-side" aria-label="Next 24 hours at a glance">
        <HeroStat
          icon={Sun}
          label="Best time outdoors"
          value={outlook ? formatModelHour(outlook.cleanWindowTime) : "—"}
          detail={outlook ? `3-hour window · about ${outlook.cleanWindowAqi} AQI` : "Forecast unavailable"}
          tone={outlook?.cleanWindowCategory.tone}
        />
        <HeroStat
          icon={TrendingUp}
          label="Expected peak"
          value={outlook ? formatModelHour(outlook.peakTime) : "—"}
          detail={outlook ? `${outlook.peak} AQI · ${outlook.peakCategory.label}` : "Forecast unavailable"}
          tone={outlook?.peakCategory.tone}
        />
        <HeroStat
          icon={Wind}
          label="Main pollutant"
          value={leadPollutant?.short ?? "—"}
          detail={Number.isFinite(insight?.componentAqi) ? `Pollutant AQI ${insight.componentAqi}` : "Not available"}
        />
      </div>
    </section>
  );
}
