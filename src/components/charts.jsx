import { useMemo, useState } from "react";
import { aqiCategory } from "../airQuality.js";
import { formatModelHour, formatTrendLabel } from "../lib/format.js";
import { historySeries, upcomingHours } from "../lib/forecast.js";
import { SegmentedControl } from "./ui.jsx";

const WIDTH = 800;
const HEIGHT = 200;
const TOP = 12;
const BOTTOM = 188;

const METRICS = [
  { value: "us_aqi", label: "US AQI", unit: "AQI" },
  { value: "pm2_5", label: "PM2.5", unit: "µg/m³" },
  { value: "pm10", label: "PM10", unit: "µg/m³" },
  { value: "nitrogen_dioxide", label: "NO₂", unit: "µg/m³" },
  { value: "ozone", label: "O₃", unit: "µg/m³" },
];
const PERIODS = [
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days + outlook" },
];

function axisLabels(samples) {
  const indexes = [0, Math.floor(samples.length / 3), Math.floor((samples.length * 2) / 3), samples.length - 1];
  return [...new Set(indexes)].map((index) => samples[index]).filter(Boolean);
}

/** Past model archive (solid) and forecast (dashed) for one metric. */
export function TrendChart({ hourly, currentTime }) {
  const [metric, setMetric] = useState("us_aqi");
  const [period, setPeriod] = useState("7d");
  const { samples, currentIndex, maximum } = useMemo(
    () => historySeries(hourly, currentTime, metric, period),
    [hourly, currentTime, metric, period],
  );
  const metricInfo = METRICS.find((item) => item.value === metric);

  const controls = (
    <div className="chart-controls">
      <SegmentedControl label="Trend metric" options={METRICS} value={metric} onChange={setMetric} size="sm" />
      <SegmentedControl label="Trend range" options={PERIODS} value={period} onChange={setPeriod} size="sm" />
    </div>
  );

  if (samples.length < 2) {
    return <>{controls}<div className="chart-empty">Trend data is not available for this location yet.</div></>;
  }

  const x = (index) => (index / (samples.length - 1)) * WIDTH;
  const y = (value) => BOTTOM - (value / maximum) * (BOTTOM - TOP);
  const nowIndex = Math.max(currentIndex, 0);
  const toPoints = (points, offset = 0) => points.map((point, index) => `${x(index + offset)},${y(point.value)}`).join(" ");
  const pastPoints = toPoints(samples.slice(0, nowIndex + 1));
  const forecastPoints = toPoints(samples.slice(nowIndex), nowIndex);
  const areaPoints = `0,${BOTTOM} ${pastPoints} ${x(nowIndex)},${BOTTOM}`;
  const currentX = x(nowIndex);
  const labels = axisLabels(samples);
  const current = samples[nowIndex];

  return (
    <div className="trend-chart">
      {controls}
      <div className="chart-legend">
        <span><i className="legend-past" />Past model archive</span>
        <span><i className="legend-forecast" />Forecast</span>
        {metric === "us_aqi" && <span><i className="legend-target" />AQI 50 (“Good” limit)</span>}
        <small>{metricInfo.unit}</small>
      </div>
      <div className="chart-frame">
        <div className="chart-y-axis" aria-hidden="true"><span>{Math.round(maximum)}</span><span>{Math.round(maximum / 2)}</span><span>0</span></div>
        <div className="chart-plot">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={`${metricInfo.label}: past model archive and forecast. Current value ${Math.round(current?.value ?? 0)} ${metricInfo.unit}.`}>
          <defs>
            <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" className="chart-fill-start" />
              <stop offset="100%" className="chart-fill-end" />
            </linearGradient>
          </defs>
          {[TOP, (TOP + BOTTOM) / 2, BOTTOM].map((lineY) => <line key={lineY} x1="0" x2={WIDTH} y1={lineY} y2={lineY} className="chart-grid" />)}
          {metric === "us_aqi" && <line x1="0" x2={WIDTH} y1={y(50)} y2={y(50)} className="chart-target" />}
          <polygon points={areaPoints} fill="url(#trend-fill)" />
          <polyline points={pastPoints} className="chart-line" />
          <polyline points={forecastPoints} className="chart-line chart-line-forecast" />
          {currentIndex >= 0 && <line x1={currentX} x2={currentX} y1={TOP - 4} y2={BOTTOM} className="chart-now" />}
        </svg>
        {currentIndex >= 0 && current && (
          <span
            className="chart-now-dot"
            style={{ left: `${(currentX / WIDTH) * 100}%`, top: `${(y(current.value) / HEIGHT) * 100}%` }}
            aria-hidden="true"
          />
        )}
        </div>
        <div className="chart-x-axis" aria-hidden="true">{labels.map((point) => <span key={point.time}>{formatTrendLabel(point.time, period)}</span>)}</div>
      </div>
      <p className="chart-caption">Past values are archived CAMS model estimates, not monitor observations. The dashed line is the model forecast from the current hour.</p>
    </div>
  );
}

/** Next-24-hour US AQI line with colour-coded hourly bars. */
export function ForecastChart({ hourly, currentTime }) {
  const forecast = useMemo(() => upcomingHours(hourly, currentTime, 24), [hourly, currentTime]);
  if (forecast.length < 2) {
    return <div className="chart-empty">Forecast values are not available for this location yet.</div>;
  }
  const maximum = Math.max(100, Math.ceil(Math.max(...forecast.map(({ value }) => value)) / 50) * 50);
  const labels = axisLabels(forecast);
  return (
    <div className="forecast-bars-wrap">
      <div className="chart-frame chart-frame-bars">
        <div className="chart-y-axis" aria-hidden="true"><span>{maximum}</span><span>{Math.round(maximum / 2)}</span><span>0</span></div>
        <ol className="forecast-bars" aria-label="Hourly US AQI forecast for the next 24 hours">
          {forecast.map(({ time, value }) => {
            const category = aqiCategory(value);
            return (
              <li key={time} className={`tone-${category.tone}`} title={`${formatModelHour(time)}: ${Math.round(value)} AQI · ${category.label}`}>
                <span className="forecast-bar" style={{ height: `${Math.max(4, (value / maximum) * 100)}%` }} />
                <span className="visually-hidden">{formatModelHour(time)}: {Math.round(value)} US AQI, {category.label}</span>
              </li>
            );
          })}
        </ol>
        <div className="chart-x-axis" aria-hidden="true">{labels.map(({ time }) => <span key={time}>{formatModelHour(time)}</span>)}</div>
      </div>
    </div>
  );
}
