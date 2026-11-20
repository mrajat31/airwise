import { Activity, AlertTriangle, CircleHelp, Route, Wind } from "lucide-react";
import { aqiCategory } from "../airQuality.js";
import { roundedAqi } from "../lib/format.js";

export const ICONS = { activity: Activity, route: Route, wind: Wind };

/** Rounded AQI with its category colour. `showLabel` adds the category name. */
export function AqiBadge({ value, showLabel = false, size = "md" }) {
  const category = aqiCategory(value);
  const rounded = roundedAqi(value);
  return (
    <span className={`aqi-badge aqi-badge-${size} tone-${category.tone}`}>
      <b>{rounded ?? "—"}</b>
      {showLabel ? <span>{category.label}</span> : <span className="visually-hidden"> US AQI, {category.label}</span>}
    </span>
  );
}

export function Card({ as: Tag = "section", className = "", children, ...props }) {
  return <Tag className={`card ${className}`} {...props}>{children}</Tag>;
}

export function CardHeader({ title, subtitle, action, eyebrow, level = 2 }) {
  const Heading = `h${level}`;
  return (
    <div className="card-header">
      <div className="card-header-text">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <Heading>{title}</Heading>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && <div className="card-header-action">{action}</div>}
    </div>
  );
}

export function Pill({ icon: Icon, children, className = "" }) {
  return <span className={`pill ${className}`}>{Icon && <Icon size={14} aria-hidden="true" />}{children}</span>;
}

export function LoadingNotice({ children }) {
  return <div className="notice notice-loading" role="status"><span className="spinner" aria-hidden="true" />{children}</div>;
}

export function ErrorNotice({ title, message, onRetry, retryLabel = "Try again" }) {
  return (
    <div className="notice notice-error" role="alert">
      <AlertTriangle size={18} aria-hidden="true" />
      <div><strong>{title}</strong><span>{message}</span></div>
      {onRetry && <button type="button" className="button button-secondary" onClick={onRetry}>{retryLabel}</button>}
    </div>
  );
}

export function Skeleton({ height = 160 }) {
  return <div className="skeleton" style={{ height }} aria-hidden="true" />;
}

export function Caveat({ children }) {
  return <p className="caveat"><CircleHelp size={14} aria-hidden="true" /><span>{children}</span></p>;
}

export function DataAttribution() {
  return (
    <p className="attribution">
      <CircleHelp size={14} aria-hidden="true" />
      <span>
        Air quality and weather are model estimates from <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> (CAMS).
        Area names use <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap data</a>.
        Resolution is regional, not street-level; nearby areas may share a grid cell. Not a substitute for official monitoring or health advice.
      </span>
    </p>
  );
}

export function SegmentedControl({ label, options, value, onChange, size = "md" }) {
  return (
    <div className={`segmented segmented-${size}`} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={value === option.value ? "active" : ""}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
