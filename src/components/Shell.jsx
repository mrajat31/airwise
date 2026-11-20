import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Bell,
  Bookmark,
  ChevronDown,
  Cloud,
  Gauge,
  LocateFixed,
  MapPin,
  Moon,
  RefreshCw,
  Sparkles,
  Star,
  Sun,
  X,
} from "lucide-react";
import { PUNE_AREAS, PUNE_CITY } from "../airQuality.js";
import { roundedAqi } from "../lib/format.js";

export const SECTIONS = [
  { id: "Overview", label: "Overview", icon: Gauge },
  { id: "Forecast", label: "Forecast", icon: Activity },
  { id: "Neighborhoods", label: "Areas", fullLabel: "Neighborhoods", icon: MapPin },
  { id: "Take action", label: "Act", fullLabel: "Take action", icon: Sparkles },
];

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true"><Activity size={18} /></span>
      <span className="brand-name">airwise<span>.</span></span>
    </div>
  );
}

export function Sidebar({ section, onNavigate, locationLabel, locationDetail }) {
  return (
    <aside className="sidebar">
      <Brand />
      <nav aria-label="Main">
        <ul className="sidebar-nav">
          {SECTIONS.map(({ id, fullLabel, label, icon: Icon }) => (
            <li key={id}>
              <button
                type="button"
                className={`nav-item ${section === id ? "active" : ""}`}
                aria-current={section === id ? "page" : undefined}
                aria-label={fullLabel ?? label}
                title={fullLabel ?? label}
                onClick={() => onNavigate(id)}
              >
                <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
                <span className="nav-text">{fullLabel ?? label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-note"><Cloud size={16} aria-hidden="true" /><span><strong>Model-based estimates</strong>Not a street-level sensor</span></div>
        <div className="sidebar-location"><MapPin size={16} aria-hidden="true" /><span><strong>{locationLabel}</strong>{locationDetail}</span></div>
      </div>
    </aside>
  );
}

export function TabBar({ section, onNavigate }) {
  return (
    <nav className="tabbar" aria-label="Main">
      {SECTIONS.map(({ id, label, fullLabel, icon: Icon }) => (
        <button
          type="button"
          key={id}
          className={section === id ? "active" : ""}
          aria-current={section === id ? "page" : undefined}
          aria-label={fullLabel ?? label}
          onClick={() => onNavigate(id)}
        >
          <Icon size={21} strokeWidth={1.9} aria-hidden="true" />
          <span aria-hidden="true">{label}</span>
        </button>
      ))}
    </nav>
  );
}

function AlertPopover({ aqi, threshold, onThresholdChange, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    const onPointer = (event) => { if (ref.current && !ref.current.contains(event.target)) onClose(); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [onClose]);
  const rounded = roundedAqi(aqi);
  const reached = rounded != null && rounded >= threshold;
  return (
    <div className="popover" ref={ref} role="dialog" aria-label="Alert threshold">
      <div className="popover-header">
        <strong><Bell size={16} aria-hidden="true" /> Alert threshold</strong>
        <button type="button" className="icon-button icon-button-ghost" onClick={onClose} aria-label="Close alert settings"><X size={16} /></button>
      </div>
      <p>Pick an AQI level to keep in mind. Airwise does not send push notifications yet.</p>
      <label className="threshold">
        <span>Remind me at <strong>{threshold} AQI</strong> or above</span>
        <input type="range" min="50" max="200" step="10" value={threshold} onChange={(event) => onThresholdChange(Number(event.target.value))} />
      </label>
      <p className={`threshold-status ${reached ? "reached" : ""}`} role="status">
        {rounded == null
          ? "Waiting for current air-quality data."
          : reached ? `Now ${rounded} AQI — at or above your level.` : `Now ${rounded} AQI — below your level.`}
      </p>
    </div>
  );
}

export function TopBar({ title, status, isLoading, onRefresh, theme, onToggleTheme, aqi, threshold, onThresholdChange }) {
  const [alertsOpen, setAlertsOpen] = useState(false);
  const reached = roundedAqi(aqi) != null && roundedAqi(aqi) >= threshold;
  return (
    <header className="topbar">
      <div className="topbar-title">
        <span className="topbar-brand"><Brand /></span>
        <span className="topbar-section">{title}</span>
      </div>
      <div className="topbar-actions">
        <span className={`status ${status.ok ? "ok" : "offline"}`} title="Model estimates update when the provider publishes new runs; this is not a real-time sensor stream.">
          <span className="status-dot" aria-hidden="true" />{status.label}
        </span>
        <button type="button" className="icon-button" onClick={onRefresh} aria-label="Refresh data" title="Refresh data">
          <RefreshCw size={17} className={isLoading ? "spin" : ""} />
        </button>
        <button type="button" className="icon-button" onClick={onToggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title="Toggle theme">
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <div className="popover-anchor">
          <button
            type="button"
            className="icon-button"
            aria-label="Air quality alert settings"
            aria-expanded={alertsOpen}
            onClick={() => setAlertsOpen((open) => !open)}
          >
            <Bell size={17} />
            {reached && <i className="badge-dot" aria-hidden="true" />}
          </button>
          {alertsOpen && <AlertPopover aqi={aqi} threshold={threshold} onThresholdChange={onThresholdChange} onClose={() => setAlertsOpen(false)} />}
        </div>
      </div>
    </header>
  );
}

export function LocationBar({ deviceLocation, savedLocations, selectedValue, onChoose, onLocate, isLocating, isSaved, onToggleSave }) {
  return (
    <div className="location-bar">
      <label className="select">
        <MapPin size={16} className="select-icon" aria-hidden="true" />
        <select aria-label="Choose a place" value={selectedValue} onChange={(event) => onChoose(event.target.value)}>
          {deviceLocation && <option value={deviceLocation.source === "saved" ? `saved:${deviceLocation.id}` : "device"}>{deviceLocation.label}</option>}
          <option value={PUNE_CITY.name}>Pune city · 12-area average</option>
          <optgroup label="Pune areas">
            {PUNE_AREAS.map((area) => <option key={area.name} value={area.name}>{area.name}</option>)}
          </optgroup>
          {savedLocations.length > 0 && (
            <optgroup label="Saved places">
              {savedLocations.map((place) => <option key={place.id} value={`saved:${place.id}`}>{place.label}</option>)}
            </optgroup>
          )}
        </select>
        <ChevronDown size={16} className="select-chevron" aria-hidden="true" />
      </label>
      <button type="button" className="button button-secondary" onClick={onLocate} disabled={isLocating}>
        <LocateFixed size={16} aria-hidden="true" />{isLocating ? "Locating…" : "Use my location"}
      </button>
      <button
        type="button"
        className={`button button-ghost ${isSaved ? "is-saved" : ""}`}
        onClick={onToggleSave}
        aria-pressed={isSaved}
        title={isSaved ? "Remove from saved places" : "Save this place"}
      >
        {isSaved ? <Star size={16} fill="currentColor" aria-hidden="true" /> : <Bookmark size={16} aria-hidden="true" />}
        {isSaved ? "Saved" : "Save"}
      </button>
    </div>
  );
}
