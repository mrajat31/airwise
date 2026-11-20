import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Bell,
  BellOff,
  BellRing,
  Bookmark,
  ChevronDown,
  Cloud,
  Gauge,
  Languages,
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
import { LANGUAGES, useI18n } from "../i18n/index.jsx";
import { THRESHOLD_MAX, THRESHOLD_MIN } from "../lib/alerts.js";
import { roundedAqi } from "../lib/format.js";

// `label`/`fullLabel` stay in English: they are stable ids for tests and analytics.
export const SECTIONS = [
  { id: "Overview", label: "Overview", key: "nav.overview", icon: Gauge },
  { id: "Forecast", label: "Forecast", key: "nav.forecast", icon: Activity },
  { id: "Neighborhoods", label: "Areas", fullLabel: "Neighborhoods", key: "nav.areas", shortKey: "nav.areasShort", icon: MapPin },
  { id: "Take action", label: "Act", fullLabel: "Take action", key: "nav.act", shortKey: "nav.actShort", icon: Sparkles },
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
  const { t } = useI18n();
  return (
    <aside className="sidebar">
      <Brand />
      <nav aria-label="Main">
        <ul className="sidebar-nav">
          {SECTIONS.map(({ id, key, icon: Icon }) => (
            <li key={id}>
              <button
                type="button"
                className={`nav-item ${section === id ? "active" : ""}`}
                aria-current={section === id ? "page" : undefined}
                aria-label={t(key)}
                title={t(key)}
                onClick={() => onNavigate(id)}
              >
                <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
                <span className="nav-text">{t(key)}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-note"><Cloud size={16} aria-hidden="true" /><span><strong>{t("sidebar.modelTitle")}</strong>{t("sidebar.modelDetail")}</span></div>
        <div className="sidebar-location"><MapPin size={16} aria-hidden="true" /><span><strong>{locationLabel}</strong>{locationDetail}</span></div>
      </div>
    </aside>
  );
}

export function TabBar({ section, onNavigate }) {
  const { t } = useI18n();
  return (
    <nav className="tabbar" aria-label="Main">
      {SECTIONS.map(({ id, key, shortKey, icon: Icon }) => (
        <button
          type="button"
          key={id}
          className={section === id ? "active" : ""}
          aria-current={section === id ? "page" : undefined}
          aria-label={t(key)}
          onClick={() => onNavigate(id)}
        >
          <Icon size={21} strokeWidth={1.9} aria-hidden="true" />
          <span aria-hidden="true">{t(shortKey ?? key)}</span>
        </button>
      ))}
    </nav>
  );
}

function AlertPopover({ aqi, alerts, onClose }) {
  const { t } = useI18n();
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
  const { threshold, notify, permission } = alerts;
  const rounded = roundedAqi(aqi);
  const reached = rounded != null && rounded >= threshold;
  let permissionNote = null;
  if (permission === "unsupported") permissionNote = t("alerts.unsupported");
  else if (permission === "denied") permissionNote = t("alerts.denied");
  else if (notify && permission === "granted") permissionNote = t("alerts.on");
  return (
    <div className="popover" ref={ref} role="dialog" aria-label={t("alerts.title")}>
      <div className="popover-header">
        <strong><Bell size={16} aria-hidden="true" /> {t("alerts.title")}</strong>
        <button type="button" className="icon-button icon-button-ghost" onClick={onClose} aria-label={t("alerts.close")}><X size={16} /></button>
      </div>
      <p>{t("alerts.intro")}</p>
      <label className="threshold">
        <span>{t("alerts.threshold", { value: threshold })}</span>
        <input
          type="range"
          min={THRESHOLD_MIN}
          max={THRESHOLD_MAX}
          step="10"
          value={threshold}
          onChange={(event) => alerts.setThreshold(Number(event.target.value))}
        />
      </label>
      <p className={`threshold-status ${reached ? "reached" : ""}`} role="status">
        {rounded == null ? t("alerts.waiting") : t(reached ? "alerts.nowAbove" : "alerts.nowBelow", { aqi: rounded })}
      </p>
      {permission !== "unsupported" && (
        <button
          type="button"
          className={`button ${notify ? "button-secondary" : "button-primary"} button-block`}
          onClick={notify ? alerts.disable : alerts.enable}
          disabled={permission === "denied" && !notify}
        >
          {notify ? <BellOff size={16} aria-hidden="true" /> : <BellRing size={16} aria-hidden="true" />}
          {t(notify ? "alerts.disable" : "alerts.enable")}
        </button>
      )}
      {permissionNote && <p className="muted small">{permissionNote}</p>}
      <p className="muted small">{t("alerts.limits")}</p>
    </div>
  );
}

function LanguagePicker() {
  const { lang, setLang, t } = useI18n();
  return (
    <label className="language-picker" title={t("top.language")}>
      <Languages size={16} aria-hidden="true" />
      <select aria-label={t("top.language")} value={lang} onChange={(event) => setLang(event.target.value)}>
        {LANGUAGES.map((language) => <option key={language.id} value={language.id} lang={language.id}>{language.label}</option>)}
      </select>
    </label>
  );
}

export function TopBar({ title, statusOk, isLoading, onRefresh, theme, onToggleTheme, aqi, alerts }) {
  const { t } = useI18n();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const rounded = roundedAqi(aqi);
  const reached = rounded != null && rounded >= alerts.threshold;
  return (
    <header className="topbar">
      <div className="topbar-title">
        <span className="topbar-brand"><Brand /></span>
        <span className="topbar-section">{title}</span>
      </div>
      <div className="topbar-actions">
        <span className={`status ${statusOk ? "ok" : "offline"}`} title={t("top.statusTitle")}>
          <span className="status-dot" aria-hidden="true" />{t(statusOk ? "top.statusOk" : "top.statusOffline")}
        </span>
        <LanguagePicker />
        <button type="button" className="icon-button" onClick={onRefresh} aria-label={t("top.refresh")} title={t("top.refresh")}>
          <RefreshCw size={17} className={isLoading ? "spin" : ""} />
        </button>
        <button type="button" className="icon-button" onClick={onToggleTheme} aria-label={t(theme === "dark" ? "top.themeToLight" : "top.themeToDark")} title={t(theme === "dark" ? "top.themeToLight" : "top.themeToDark")}>
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <div className="popover-anchor">
          <button
            type="button"
            className="icon-button"
            aria-label={t("top.alerts")}
            aria-expanded={alertsOpen}
            onClick={() => setAlertsOpen((open) => !open)}
          >
            {alerts.notify ? <BellRing size={17} /> : <Bell size={17} />}
            {reached && <i className="badge-dot" aria-hidden="true" />}
          </button>
          {alertsOpen && <AlertPopover aqi={aqi} alerts={alerts} onClose={() => setAlertsOpen(false)} />}
        </div>
      </div>
    </header>
  );
}

export function LocationBar({ deviceLocation, savedLocations, selectedValue, onChoose, onLocate, isLocating, isSaved, onToggleSave }) {
  const { t } = useI18n();
  return (
    <div className="location-bar">
      <label className="select">
        <MapPin size={16} className="select-icon" aria-hidden="true" />
        <select aria-label={t("loc.choose")} value={selectedValue} onChange={(event) => onChoose(event.target.value)}>
          {deviceLocation && <option value={deviceLocation.source === "saved" ? `saved:${deviceLocation.id}` : "device"}>{deviceLocation.label}</option>}
          <option value={PUNE_CITY.name}>{t("loc.cityOption")}</option>
          <optgroup label={t("loc.areasGroup")}>
            {PUNE_AREAS.map((area) => <option key={area.name} value={area.name}>{area.name}</option>)}
          </optgroup>
          {savedLocations.length > 0 && (
            <optgroup label={t("loc.savedGroup")}>
              {savedLocations.map((place) => <option key={place.id} value={`saved:${place.id}`}>{place.label}</option>)}
            </optgroup>
          )}
        </select>
        <ChevronDown size={16} className="select-chevron" aria-hidden="true" />
      </label>
      <button type="button" className="button button-secondary" onClick={onLocate} disabled={isLocating}>
        <LocateFixed size={16} aria-hidden="true" />{t(isLocating ? "loc.locating" : "loc.useMine")}
      </button>
      <button
        type="button"
        className={`button button-ghost ${isSaved ? "is-saved" : ""}`}
        onClick={onToggleSave}
        aria-pressed={isSaved}
        title={t(isSaved ? "loc.unsaveTitle" : "loc.saveTitle")}
      >
        {isSaved ? <Star size={16} fill="currentColor" aria-hidden="true" /> : <Bookmark size={16} aria-hidden="true" />}
        {t(isSaved ? "loc.saved" : "loc.save")}
      </button>
    </div>
  );
}
