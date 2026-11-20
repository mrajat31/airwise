import { useMemo } from "react";
import { ArrowRight, Cloud, Compass, Droplets, ShieldCheck, Thermometer, Wind } from "lucide-react";
import { aqiCategory, weatherDescription } from "../airQuality.js";
import { formatModelHour, formatModelWeekday, formatNumber } from "../lib/format.js";
import { dailyOutlook, upcomingHours } from "../lib/forecast.js";
import { POLLUTANTS } from "../lib/insights.js";
import { AqiBadge, Caveat, Card, CardHeader, ICONS } from "./ui.jsx";

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
function compassDirection(degrees) {
  return Number.isFinite(degrees) ? COMPASS[Math.round((((degrees % 360) + 360) % 360) / 45) % 8] : "—";
}

export function PollutantGrid({ current }) {
  return (
    <Card className="pollutants-card">
      <CardHeader title="Pollutants" subtitle="Current model concentrations and their AQI sub-index" />
      <ul className="pollutant-grid">
        {POLLUTANTS.map((pollutant) => {
          const componentAqi = current?.[pollutant.aqiKey];
          const category = aqiCategory(componentAqi);
          return (
            <li key={pollutant.id} className={`pollutant tone-${category.tone}`}>
              <div className="pollutant-top"><span className="pollutant-name">{pollutant.short}</span><AqiBadge value={componentAqi} size="sm" /></div>
              <strong>{formatNumber(current?.[pollutant.id], current?.[pollutant.id] < 10 ? 1 : 0)}<small> {pollutant.unit}</small></strong>
              <span className="pollutant-meter" aria-hidden="true"><i style={{ width: `${Math.min(100, ((componentAqi ?? 0) / 200) * 100)}%` }} /></span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function InsightPanel({ insight, onPlan }) {
  return (
    <Card className="insight-card">
      <CardHeader eyebrow="What may be driving it" title={insight.label} subtitle={insight.summary} />
      <ol className="insight-steps">{insight.actions.slice(0, 2).map((action) => <li key={action}>{action}</li>)}</ol>
      <div className="insight-protect"><ShieldCheck size={18} aria-hidden="true" /><p>{insight.protection}</p></div>
      <div className="card-actions">
        <button type="button" className="button button-secondary" onClick={onPlan}>Build a local action plan <ArrowRight size={16} aria-hidden="true" /></button>
      </div>
      <Caveat>A model-based clue, not proof of what caused the pollution. Check official readings before making decisions.</Caveat>
    </Card>
  );
}

export function HourlyStrip({ hourly, currentTime, count = 8 }) {
  const hours = useMemo(
    () => upcomingHours(hourly, currentTime, count * 3).filter((_, index) => index % 3 === 0).slice(0, count),
    [hourly, currentTime, count],
  );
  if (hours.length === 0) return null;
  return (
    <ul className="hourly-strip" aria-label="Forecast every three hours">
      {hours.map(({ time, value }) => (
        <li key={time} className={`tone-${aqiCategory(value).tone}`}>
          <span className="hourly-time">{formatModelHour(time)}</span>
          <strong>{Math.round(value)}</strong>
          <span className="hourly-category">{aqiCategory(value).label}</span>
        </li>
      ))}
    </ul>
  );
}

export function DailyForecast({ hourly, currentTime }) {
  const days = useMemo(() => dailyOutlook(hourly, currentTime), [hourly, currentTime]);
  if (days.length === 0) return <div className="chart-empty">Daily outlook is not available yet.</div>;
  const scaleMax = Math.max(150, ...days.map((day) => day.peak));
  return (
    <ul className="daily-list">
      {days.map((day, index) => {
        const category = aqiCategory(day.peak);
        return (
          <li key={day.date} className={`tone-${category.tone}`}>
            <span className="daily-day">{index === 0 ? "Today" : formatModelWeekday(day.date)}</span>
            <span className="daily-range" aria-hidden="true"><i style={{ width: `${(day.peak / scaleMax) * 100}%` }} /></span>
            <span className="daily-values"><b>{day.average}</b> avg · peak {day.peak}</span>
            <span className="daily-category">{category.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function WeatherPanel({ weather, error }) {
  const current = weather?.current;
  return (
    <Card className="weather-card">
      <CardHeader title="Local weather" subtitle={error ? "Weather data is temporarily unavailable." : "Wind and humidity affect how pollution disperses."} action={<Cloud size={20} aria-hidden="true" />} />
      {error && <p className="inline-error" role="alert">{error}</p>}
      {!error && !current && <p className="muted">Waiting for current conditions…</p>}
      {!error && current && (
        <>
          <div className="weather-now">
            <strong>{Math.round(current.temperature_2m)}°C</strong>
            <span>{weatherDescription(current.weather_code)}</span>
          </div>
          <dl className="weather-stats">
            <div><dt><Wind size={15} aria-hidden="true" />Wind</dt><dd>{Math.round(current.wind_speed_10m)} km/h</dd></div>
            <div><dt><Compass size={15} aria-hidden="true" />From</dt><dd>{compassDirection(current.wind_direction_10m)} ({Math.round(current.wind_direction_10m)}°)</dd></div>
            <div><dt><Droplets size={15} aria-hidden="true" />Humidity</dt><dd>{Math.round(current.relative_humidity_2m)}%</dd></div>
            <div><dt><Thermometer size={15} aria-hidden="true" />Model time</dt><dd>{current.time?.split("T")[1] ?? "—"}</dd></div>
          </dl>
        </>
      )}
    </Card>
  );
}

export function RecommendationCard({ action }) {
  const Icon = ICONS[action.icon] ?? ICONS.activity;
  return (
    <li className={`recommendation tone-${action.tone}`}>
      <span className="recommendation-icon"><Icon size={18} aria-hidden="true" /></span>
      <div>
        <span className="eyebrow">{action.type}</span>
        <h3>{action.title}</h3>
        <p>{action.detail}</p>
        <small>Why this is suggested: {action.basis}</small>
      </div>
    </li>
  );
}
