import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bookmark,
  Building2,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Cloud,
  Compass,
  FileDown,
  Gauge,
  Leaf,
  LocateFixed,
  MapPin,
  Menu,
  RefreshCw,
  Route,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Wind,
  X,
} from "lucide-react";
import {
  aqiCategory,
  aggregateAreaReadings,
  fetchAirQuality,
  fetchAreaAirQuality,
  fetchWeather,
  localTime,
  PUNE_AREAS,
  PUNE_CITY,
  reverseGeocode,
  weatherDescription,
} from "./airQuality.js";
import { AREA_ACTION_SOURCES, generateAreaActionSuggestions } from "./areaActionPlan.js";

const navigation = [
  { label: "Overview", icon: Gauge },
  { label: "Forecast", icon: Activity },
  { label: "Neighborhoods", icon: MapPin },
  { label: "Take action", icon: Sparkles },
];

function formatModelHour(value) {
  const [hours = "00", minutes = "00"] = value?.split("T")[1]?.split(":") ?? [];
  const hour = Number(hours);
  return `${hour % 12 || 12}${minutes === "00" ? "" : `:${minutes}`} ${hour < 12 ? "AM" : "PM"}`;
}

function formatFreshness(localTimestamp, offsetSeconds = 0) {
  if (!localTimestamp) return "Update time unavailable";
  const offsetHours = Math.trunc(offsetSeconds / 3600);
  const offsetMinutes = Math.abs(Math.trunc((offsetSeconds % 3600) / 60));
  const offset = `${offsetHours < 0 ? "-" : "+"}${String(Math.abs(offsetHours)).padStart(2, "0")}:${String(offsetMinutes).padStart(2, "0")}`;
  const updatedAt = new Date(`${localTimestamp}${offset}`);
  if (Number.isNaN(updatedAt.getTime())) return `Model update ${localTimestamp.replace("T", " ")}`;
  const minutes = Math.max(0, Math.floor((Date.now() - updatedAt.getTime()) / 60000));
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `Updated ${hours}h ${minutes % 60}m ago` : `Updated ${Math.floor(hours / 24)}d ago`;
}

function healthGuidance(aqi) {
  if (!Number.isFinite(aqi)) {
    return {
      label: "Waiting for a reading",
      summary: "Load an air-quality update to see guidance matched to the current model estimate.",
      steps: ["Check local official air-quality alerts for current conditions."],
    };
  }
  if (aqi <= 50) {
    return {
      label: "Good · usual outdoor plans",
      summary: "Air quality is satisfactory; enjoy your usual outdoor activities.",
      steps: ["People unusually sensitive to air pollution can still pay attention to symptoms."],
    };
  }
  if (aqi <= 100) {
    return {
      label: "Moderate · sensitive people take care",
      summary: "Most people can continue usual activities. Unusually sensitive people may notice symptoms.",
      steps: ["If you are unusually sensitive, consider reducing prolonged or heavy outdoor exertion if symptoms occur."],
    };
  }
  if (aqi <= 150) {
    return {
      label: "Sensitive groups · reduce prolonged exertion",
      summary: "People with asthma or heart and lung conditions, children, and older adults may be more affected.",
      steps: ["Sensitive groups should reduce prolonged or heavy outdoor exertion.", "Most other people can continue usual activities, while watching for symptoms."],
    };
  }
  if (aqi <= 200) {
    return {
      label: "Unhealthy · limit longer outdoor exertion",
      summary: "Some people may experience effects; sensitive groups may experience more serious effects.",
      steps: ["Sensitive groups should avoid prolonged or heavy outdoor exertion.", "Everyone else should consider reducing prolonged outdoor exertion."],
    };
  }
  if (aqi <= 300) {
    return {
      label: "Very unhealthy · reduce outdoor exposure",
      summary: "Health effects may be experienced by everyone, with higher risk for sensitive groups.",
      steps: ["Reduce outdoor physical activity; sensitive groups should avoid it.", "Move activity indoors to a cleaner-air space when possible."],
    };
  }
  return {
    label: "Hazardous · avoid outdoor exertion",
    summary: "Health warning: everyone may be affected. Follow official local advisories.",
    steps: ["Avoid outdoor physical activity and follow local authority guidance.", "Use a cleaner indoor room and reduce outdoor air entering the space where practical."],
  };
}

function AirQualityChart({ hourly, currentTime }) {
  const forecast = useMemo(() => {
    const times = hourly?.time ?? [];
    const values = hourly?.us_aqi ?? [];
    const start = Math.max(0, times.findIndex((time) => time >= currentTime));
    return times.slice(start, start + 24).flatMap((time, index) => {
      const value = values[start + index];
      return Number.isFinite(value) ? [{ time, value }] : [];
    });
  }, [hourly, currentTime]);

  if (forecast.length < 2) {
    return <div className="chart-empty">Forecast values are not available for this location yet.</div>;
  }

  const maximum = Math.max(100, Math.ceil(Math.max(...forecast.map(({ value }) => value)) / 50) * 50);
  const points = forecast.map(({ value }, index) => {
    const x = (index / (forecast.length - 1)) * 800;
    const y = 90 - (value / maximum) * 76;
    return `${x},${y}`;
  }).join(" ");
  const fillPoints = `0,100 ${points} 800,100`;
  const labels = [0, Math.floor(forecast.length / 3), Math.floor((forecast.length * 2) / 3), forecast.length - 1]
    .map((index) => forecast[index])
    .filter((point, index, list) => point && list.findIndex((item) => item.time === point.time) === index);

  return (
    <div className="forecast-chart">
      <div className="chart-axis"><span>{maximum}</span><span>{Math.round(maximum / 2)}</span><span>0 AQI</span></div>
      <svg viewBox="0 0 800 106" preserveAspectRatio="none" role="img" aria-label="Hourly air quality forecast">
        <defs>
          <linearGradient id="aqiFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#e98768" stopOpacity=".23" />
            <stop offset="100%" stopColor="#e98768" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[14, 52, 90].map((y) => <line key={y} x1="0" x2="800" y1={y} y2={y} className="chart-grid-line" />)}
        <polygon points={fillPoints} fill="url(#aqiFill)" />
        <polyline points={points} className="aqi-forecast-line" />
        <circle cx="0" cy={90 - (forecast[0].value / maximum) * 76} r="4" className="aqi-forecast-dot" />
      </svg>
      <div className="chart-time-labels">
        {labels.map(({ time }) => <span key={time}>{formatModelHour(time)}</span>)}
      </div>
    </div>
  );
}

function ForecastInsights({ hourly, currentTime, locationLabel }) {
  const outlook = useMemo(() => {
    const times = hourly?.time ?? [];
    const values = hourly?.us_aqi ?? [];
    const start = Math.max(0, times.findIndex((time) => time >= currentTime));
    const points = times.slice(start, start + 24).flatMap((time, index) => {
      const value = values[start + index];
      return Number.isFinite(value) ? [{ time, value }] : [];
    });
    if (points.length < 3) return null;
    const peak = points.reduce((highest, point) => point.value > highest.value ? point : highest);
    const window = points.slice(0, -2).map((_, index) => {
      const hours = points.slice(index, index + 3);
      return { time: hours[0].time, average: hours.reduce((sum, point) => sum + point.value, 0) / hours.length };
    }).reduce((lowest, item) => item.average < lowest.average ? item : lowest);
    return {
      peak: Math.round(peak.value),
      peakTime: formatModelHour(peak.time),
      cleanWindow: formatModelHour(window.time),
      cleanWindowAqi: Math.round(window.average),
      highestCategory: aqiCategory(peak.value).label,
    };
  }, [hourly, currentTime]);

  if (!outlook) return null;
  return (
    <section className="forecast-insights panel-card">
      <div className="forecast-insight-heading">
        <span className="forecast-insight-icon"><Sparkles size={16} /></span>
        <div><strong>Coming up in {locationLabel}</strong><p>A simple guide to the next 24 hours</p></div>
      </div>
      <div className="forecast-insight-grid">
        <div className="forecast-insight-item">
          <span>Better time for outdoor activity</span>
          <strong>{outlook.cleanWindow}</strong>
          <small>Estimated AQI around {outlook.cleanWindowAqi}</small>
        </div>
        <div className="forecast-insight-item">
          <span>Air may be most polluted</span>
          <strong>{outlook.peakTime}</strong>
          <small>Estimated AQI {outlook.peak} · {outlook.highestCategory}</small>
        </div>
        <p className="forecast-insight-note">If the air is poor, consider lighter or indoor exercise. Forecasts can change; follow local health advice.</p>
      </div>
    </section>
  );
}

function AirHistoryChart({ hourly, currentTime }) {
  const [metric, setMetric] = useState("us_aqi");
  const [period, setPeriod] = useState("7d");
  const metrics = {
    us_aqi: { label: "US AQI", unit: "AQI" },
    pm2_5: { label: "PM2.5", unit: "µg/m³" },
    pm10: { label: "PM10", unit: "µg/m³" },
    nitrogen_dioxide: { label: "NO₂", unit: "µg/m³" },
    ozone: { label: "O₃", unit: "µg/m³" },
  };
  const { samples, currentIndex, maximum } = useMemo(() => {
    const times = hourly?.time ?? [];
    const values = hourly?.[metric] ?? [];
    const nowIndex = Math.max(0, times.findIndex((time) => time >= currentTime));
    const before = period === "24h" ? 12 : 168;
    const after = period === "24h" ? 12 : 120;
    const start = Math.max(0, nowIndex - before);
    const end = Math.min(times.length - 1, nowIndex + after);
    const step = period === "24h" ? 1 : 3;
    const indexes = new Set();
    for (let index = start; index <= end; index += step) indexes.add(index);
    indexes.add(nowIndex);
    const points = [...indexes].sort((a, b) => a - b).flatMap((index) =>
      Number.isFinite(values[index]) ? [{ time: times[index], value: values[index] }] : []);
    return {
      samples: points,
      currentIndex: points.findIndex((point) => point.time >= currentTime),
      maximum: Math.max(metric === "us_aqi" ? 150 : 1, ...points.map(({ value }) => value)) * 1.12,
    };
  }, [hourly, currentTime, metric, period]);

  if (samples.length < 2) {
    return <div className="chart-empty">Trend data is not available for this location yet.</div>;
  }
  const x = (index) => (index / (samples.length - 1)) * 800;
  const y = (value) => 92 - (value / maximum) * 78;
  const pastPoints = samples.slice(0, Math.max(currentIndex + 1, 1))
    .map((point, index) => `${x(index)},${y(point.value)}`).join(" ");
  const forecastPoints = samples.slice(Math.max(currentIndex, 0))
    .map((point, index) => `${x(index + Math.max(currentIndex, 0))},${y(point.value)}`).join(" ");
  const currentX = x(Math.max(currentIndex, 0));
  const labelIndexes = [0, Math.floor(samples.length / 3), Math.floor((samples.length * 2) / 3), samples.length - 1];
  const labels = [...new Set(labelIndexes)].map((index) => samples[index]).filter(Boolean);

  return (
    <div className="air-history-chart">
      <div className="trend-controls">
        <div className="trend-metrics" aria-label="Select trend metric">
          {Object.entries(metrics).map(([key, item]) => <button key={key} className={metric === key ? "active" : ""} onClick={() => setMetric(key)}>{item.label}</button>)}
        </div>
        <div className="period-switch" aria-label="Select trend range">
          <button className={period === "24h" ? "active" : ""} onClick={() => setPeriod("24h")}>24 hours</button>
          <button className={period === "7d" ? "active" : ""} onClick={() => setPeriod("7d")}>7 days + outlook</button>
        </div>
      </div>
      <div className="trend-legend"><span><i className="trend-legend-past" />Past model archive</span><span><i className="trend-legend-forecast" />Forecast</span><small>{metrics[metric].unit}</small></div>
      <div className="trend-plot">
        <div className="trend-axis"><span>{Math.round(maximum)}</span><span>{Math.round(maximum / 2)}</span><span>0</span></div>
        <svg viewBox="0 0 800 106" preserveAspectRatio="none" role="img" aria-label={`${metrics[metric].label} past model archive and forecast`}>
          {[14, 53, 92].map((lineY) => <line key={lineY} x1="0" x2="800" y1={lineY} y2={lineY} className="chart-grid-line" />)}
          {metric === "us_aqi" && <line x1="0" x2="800" y1={y(50)} y2={y(50)} className="aqi-good-line" />}
          {currentIndex >= 0 && <line x1={currentX} x2={currentX} y1="8" y2="94" className="trend-now-line" />}
          {pastPoints && <polyline points={pastPoints} className="trend-past-line" />}
          {forecastPoints && <polyline points={forecastPoints} className="trend-forecast-line" />}
          {currentIndex >= 0 && samples[currentIndex] && <circle cx={currentX} cy={y(samples[currentIndex].value)} r="4" className="aqi-forecast-dot" />}
        </svg>
        <div className="trend-axis-labels">{labels.map((point) => <span key={point.time}>{new Date(point.time).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>)}</div>
      </div>
      <p className="trend-caption">Past values are archived CAMS model estimates, not monitor observations. Future values are model forecasts; the dashed line starts at the current model time.</p>
    </div>
  );
}

function AreaHotspotMap({ readings, loading, activeArea, onSelectArea }) {
  const points = PUNE_AREAS.map((area, index) => ({
    ...area,
    reading: readings[index]?.current,
  }));
  const minLatitude = Math.min(...PUNE_AREAS.map((area) => area.latitude));
  const maxLatitude = Math.max(...PUNE_AREAS.map((area) => area.latitude));
  const minLongitude = Math.min(...PUNE_AREAS.map((area) => area.longitude));
  const maxLongitude = Math.max(...PUNE_AREAS.map((area) => area.longitude));
  const project = (area) => ({
    x: 34 + ((area.longitude - minLongitude) / (maxLongitude - minLongitude)) * 332,
    y: 25 + ((maxLatitude - area.latitude) / (maxLatitude - minLatitude)) * 190,
  });
  const colorForAQI = (value) => {
    if (!Number.isFinite(value)) return "#a8b2aa";
    if (value <= 50) return "#5d9d6d";
    if (value <= 100) return "#d2ae52";
    if (value <= 150) return "#e58a5b";
    return "#cf6562";
  };
  const labelOffset = (name) => {
    if (name === "Kothrud") return { x: -18, valueY: -10, labelY: 3 };
    if (name === "Warje") return { x: 12, valueY: -12, labelY: 23 };
    return { x: 0, valueY: -12, labelY: 21 };
  };

  return (
    <section className="panel-card hotspot-panel">
      <div className="section-heading"><div><h2>Air quality around Pune</h2><p>Choose an area to see its current estimate and trend</p></div><span className="model-pill"><MapPin size={12} /> Pune and nearby areas</span></div>
      <div className="hotspot-map" role="group" aria-label="Interactive Pune area AQI map">
        <svg viewBox="0 0 400 245" role="img" aria-label="Pune area model estimate hotspots">
          <defs>
            <pattern id="map-grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M 22 0 L 0 0 0 22" fill="none" stroke="#e8ede7" strokeWidth="1" /></pattern>
            <radialGradient id="map-wash"><stop offset="0%" stopColor="#e9eee2" /><stop offset="100%" stopColor="#f7f8f4" /></radialGradient>
          </defs>
          <rect width="400" height="245" fill="url(#map-wash)" />
          <rect width="400" height="245" fill="url(#map-grid)" opacity=".8" />
          {points.map((area) => {
            const position = project(area);
            const offset = labelOffset(area.name);
            const value = area.reading?.us_aqi;
            const selected = activeArea === area.name;
            return <g
              key={area.name}
              className={`hotspot-point ${selected ? "selected" : ""}`}
              role="button"
              tabIndex="0"
              aria-pressed={selected}
              aria-label={`${area.name}: ${Number.isFinite(value) ? `${Math.round(value)} US AQI` : "reading unavailable"}. Select area.`}
              onClick={() => onSelectArea(area.name)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectArea(area.name);
                }
              }}
            >
              <title>{`${area.name}: ${Number.isFinite(value) ? `${Math.round(value)} US AQI` : "reading unavailable"} · model grid estimate`}</title>
              <circle cx={position.x} cy={position.y} r={selected ? 15 : 12} fill={colorForAQI(value)} opacity=".22" />
              <circle cx={position.x} cy={position.y} r={selected ? 8 : 6} fill={colorForAQI(value)} stroke="#fff" strokeWidth="2" />
              <text x={position.x + offset.x} y={position.y + offset.valueY} textAnchor="middle" className="hotspot-value">{Number.isFinite(value) ? Math.round(value) : "—"}</text>
              <text x={position.x + offset.x} y={position.y + offset.labelY} textAnchor="middle" className="hotspot-label">{area.name}</text>
            </g>;
          })}
        </svg>
        {loading && <div className="hotspot-loading">Refreshing area estimates…</div>}
      </div>
      <div className="hotspot-legend"><span><i className="good" />Good</span><span><i className="moderate" />Moderate</span><span><i className="sensitive" />Sensitive groups</span><span><i className="unhealthy" />Unhealthy+</span></div>
      <div className="area-quick-list" aria-label="Choose a Pune area">
        {points.map((area) => <button key={area.name} className={activeArea === area.name ? "selected" : ""} onClick={() => onSelectArea(area.name)} aria-pressed={activeArea === area.name}>
          <span>{area.name}</span><strong>{Number.isFinite(area.reading?.us_aqi) ? Math.round(area.reading.us_aqi) : "—"}</strong>
        </button>)}
      </div>
      <p className="hotspot-note">These are weather-model estimates, not street monitors. Nearby areas can show the same number because the data is not detailed enough to separate every neighborhood.</p>
    </section>
  );
}

function PollutantCard({ label, value, unit, icon: Icon, tone }) {
  return (
    <div className="pollutant-card">
      <div className={`pollutant-icon ${tone}`}><Icon size={17} /></div>
      <span className="pollutant-label">{label}</span>
      <strong>{Number.isFinite(value) ? Number(value).toFixed(value < 10 ? 1 : 0) : "—"}<small> {unit}</small></strong>
      <span className="reading-caption">Current model estimate</span>
    </div>
  );
}

function AreaAQIBadge({ value }) {
  const category = aqiCategory(value);
  return <span className={`area-aqi-badge ${category.tone}`}>{Number.isFinite(value) ? Math.round(value) : "—"} <small>AQI</small></span>;
}

function ActionCard({ action }) {
  const Icon = action.icon;
  return (
    <article className="recommendation-card">
      <div className={`recommendation-icon ${action.tone}`}><Icon size={18} /></div>
      <div className="recommendation-copy">
        <span className="recommendation-type">{action.type}</span>
        <h3>{action.title}</h3>
        <p>{action.detail}</p>
        <span className="recommendation-basis">Why this is suggested: {action.basis}</span>
      </div>
    </article>
  );
}

function makeRecommendations(readings) {
  if (!readings?.current) return [];
  const { current } = readings;
  const ideas = [];
  if (current.pm10 >= 45 || current.pm2_5 >= 25) {
    ideas.push({
      id: "dust-check",
      type: "DUST & CONSTRUCTION",
      title: "Check dust controls around active worksites",
      detail: "Review site covering, wheel washing, and road-cleaning schedules near busy routes.",
      basis: `modelled PM10 ${Number(current.pm10).toFixed(0)} and PM2.5 ${Number(current.pm2_5).toFixed(0)} µg/m³`,
      icon: Wind,
      tone: "blue",
    });
  }
  if (current.nitrogen_dioxide >= 20) {
    ideas.push({
      id: "traffic-check",
      type: "TRAFFIC & MOBILITY",
      title: "Review peak-hour traffic pinch points",
      detail: "Check idling and heavy-vehicle patterns with local transport and traffic teams.",
      basis: `modelled nitrogen dioxide ${Number(current.nitrogen_dioxide).toFixed(1)} µg/m³`,
      icon: Route,
      tone: "amber",
    });
  }
  if (ideas.length === 0) {
    ideas.push({
      id: "monitoring-check",
      type: "ROUTINE MONITORING",
      title: "Keep monitoring local conditions",
      detail: "Use the next-day outlook to plan outdoor activity and review any new local observations.",
      basis: "current modelled AQI and particulate levels are below the dashboard's screening triggers",
      icon: Activity,
      tone: "green",
    });
  }
  return ideas;
}

function locationKey(location) {
  return `${location.latitude.toFixed(5)},${location.longitude.toFixed(5)}`;
}

function sameSavedPlace(first, second) {
  if (first.id === second.id) return true;
  if (first.label !== second.label || first.region !== second.region) return false;
  const meanLatitude = (first.latitude + second.latitude) / 2;
  const latitudeKm = (first.latitude - second.latitude) * 111;
  const longitudeKm = (first.longitude - second.longitude) * 111 * Math.cos(meanLatitude * Math.PI / 180);
  return Math.hypot(latitudeKm, longitudeKm) <= 0.2;
}

function readSavedLocations() {
  try {
    const saved = JSON.parse(localStorage.getItem("airwise.savedLocations") || "[]");
    if (!Array.isArray(saved)) throw new Error("Saved places must be a list.");
    const validPlaces = saved.filter((place) =>
      typeof place.id === "string"
      && typeof place.label === "string"
      && Number.isFinite(place.latitude)
      && Number.isFinite(place.longitude));
    return validPlaces.filter((place, index) =>
      !validPlaces.slice(0, index).some((earlier) => sameSavedPlace(earlier, place)));
  } catch (error) {
    throw new Error("Saved places could not be read from this browser. Check local storage settings.");
  }
}

function overviewPollutantSignals(readings) {
  const current = readings?.current;
  if (!current) return [];
  return [
    {
      id: "pm2_5",
      label: "PM2.5 fine particles",
      value: current.pm2_5,
      componentAqi: current.us_aqi_pm2_5,
    },
    {
      id: "pm10",
      label: "PM10 coarse particles",
      value: current.pm10,
      componentAqi: current.us_aqi_pm10,
    },
    {
      id: "nitrogen_dioxide",
      label: "NO₂ nitrogen dioxide",
      value: current.nitrogen_dioxide,
      componentAqi: current.us_aqi_nitrogen_dioxide,
    },
    {
      id: "ozone",
      label: "O₃ ozone",
      value: current.ozone,
      componentAqi: current.us_aqi_ozone,
    },
  ];
}

function getOverviewInsight(readings) {
  const signals = overviewPollutantSignals(readings).filter((signal) => Number.isFinite(signal.componentAqi));
  const leadSignal = signals.sort((first, second) => second.componentAqi - first.componentAqi)[0];
  if (!leadSignal) {
    return {
      id: null,
      label: "No pollutant detail yet",
      componentAqi: null,
      concentration: null,
      summary: "We don't have enough detail to tell which type of pollution is highest right now.",
      actions: ["Refresh the reading and check a nearby official air-quality monitor."],
      protection: "Use the overall AQI and follow local health advice.",
    };
  }
  const insights = {
    pm2_5: {
      summary: "Very small particles are the strongest signal in this reading. They can come from several sources, so this is a clue—not a diagnosis.",
      actions: [
        "Ask local teams to check busy roads, diesel exhaust, generators, and open burning nearby.",
        "If a source is confirmed, focus on that source and check the air again to see if conditions change.",
      ],
      protection: "When air quality is poor, spend less time doing strenuous activity outdoors. A suitable HEPA filter can help with particles indoors.",
    },
    pm10: {
      summary: "Larger dust particles are the strongest signal in this reading. Road or construction dust could be checked, but the model cannot confirm the source.",
      actions: [
        "Ask local teams to check construction sites, uncovered loads, and dusty roads nearby.",
        "If dust is found, request safer material covering and dust control, then check whether readings improve.",
      ],
      protection: "When air quality is poor, avoid strenuous activity in dusty places. Planting trees is a long-term benefit, not a quick fix for dust.",
    },
    nitrogen_dioxide: {
      summary: "A gas linked to burning fuel is the strongest signal. Traffic may be one source, but this reading cannot confirm that.",
      actions: [
        "Ask local teams to check traffic queues, idling vehicles, and bus or delivery stops nearby.",
        "If traffic is confirmed, consider reducing idling and improving public transport, then measure the air again.",
      ],
      protection: "Check the forecast before strenuous outdoor activity. An air cleaner indoors does not change the air outside.",
    },
    ozone: {
      summary: "Ozone is the strongest signal. It forms in the air on sunny days, so one area's vehicle or tree count cannot predict its level.",
      actions: [
        "Check how ozone changes through the day and compare it with official readings.",
        "Ozone can travel across areas, so work with city teams on wider solutions and measure the results.",
      ],
      protection: "Use the hourly forecast to avoid strenuous activity when ozone is higher. A standard HEPA filter does not remove ozone outdoors.",
    },
  };
  return {
    id: leadSignal.id,
    label: leadSignal.label,
    componentAqi: Math.round(leadSignal.componentAqi),
    concentration: leadSignal.value,
    summary: insights[leadSignal.id].summary,
    actions: insights[leadSignal.id].actions,
    protection: insights[leadSignal.id].protection,
  };
}

function App() {
  const [section, setSection] = useState("Overview");
  const [areaName, setAreaName] = useState(PUNE_CITY.name);
  const [deviceLocation, setDeviceLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [locationError, setLocationError] = useState("");
  const [air, setAir] = useState(null);
  const [weather, setWeather] = useState(null);
  const [airError, setAirError] = useState("");
  const [weatherError, setWeatherError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [areaReadings, setAreaReadings] = useState([]);
  const [areasLoading, setAreasLoading] = useState(false);
  const [areasError, setAreasError] = useState("");
  const [comparisonAreas, setComparisonAreas] = useState(["Kothrud", "Baner"]);
  const [comparisonReport, setComparisonReport] = useState(null);
  const [planShareMessage, setPlanShareMessage] = useState("");
  const [targetAqi, setTargetAqi] = useState("50");
  const [generatedSuggestions, setGeneratedSuggestions] = useState(null);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [threshold, setThreshold] = useState(100);
  const [savedLocations, setSavedLocations] = useState([]);
  const [savedLocationsReady, setSavedLocationsReady] = useState(false);
  const [savedLocationError, setSavedLocationError] = useState("");
  const locationRequestId = useRef(0);
  const airCache = useRef(new Map());
  const areaReadingsRefreshKey = useRef(-1);
  const isCitywide = !deviceLocation && areaName === PUNE_CITY.name;
  const location = deviceLocation ?? (isCitywide ? PUNE_CITY : PUNE_AREAS.find((area) => area.name === areaName));
  const locationLabel = deviceLocation?.label ?? location.name;
  const currentLocationId = locationKey(location);
  const comparisonReadings = comparisonAreas.map((name) => ({
    name,
    reading: areaReadings[PUNE_AREAS.findIndex((area) => area.name === name)]?.current,
  }));
  const comparisonReady = comparisonReadings.length >= 2 && comparisonReadings.every(({ reading }) => Number.isFinite(reading?.us_aqi));
  const areaCitySummary = useMemo(
    () => areaReadings.length === PUNE_AREAS.length ? aggregateAreaReadings(areaReadings) : null,
    [areaReadings],
  );
  const recommendations = useMemo(() => makeRecommendations(air), [air]);
  const overviewInsight = useMemo(() => getOverviewInsight(air), [air]);
  const visibleRecommendations = recommendations.filter((action) =>
    `${action.title} ${action.detail} ${action.type}`.toLowerCase().includes(search.toLowerCase()));
  const category = aqiCategory(air?.current?.us_aqi);
  const currentTime = air?.current?.time;
  const freshness = formatFreshness(currentTime, air?.utc_offset_seconds);
  const health = healthGuidance(air?.current?.us_aqi);
  const currentAqi = Number.isFinite(air?.current?.us_aqi) ? Math.round(air.current.us_aqi) : null;
  const numericTarget = Number(targetAqi);
  const goalValue = targetAqi === "" ? null : Number.isFinite(numericTarget) ? Math.max(0, Math.min(500, numericTarget)) : 50;
  const goalGap = currentAqi == null || goalValue == null ? null : Math.max(0, currentAqi - goalValue);
  const hasCurrentSuggestions = generatedSuggestions
    && generatedSuggestions.areaLabel === locationLabel
    && generatedSuggestions.locationId === currentLocationId
    && generatedSuggestions.targetAqi === goalValue
    && generatedSuggestions.currentAqi === currentAqi
    && generatedSuggestions.signalId === overviewInsight.id;
  const currentPlace = {
    id: currentLocationId,
    label: deviceLocation?.label ?? location.name,
    region: deviceLocation?.region ?? "Pune, Maharashtra",
    latitude: location.latitude,
    longitude: location.longitude,
  };
  const isCurrentLocationSaved = savedLocations.some((place) => sameSavedPlace(place, currentPlace));
  const selectedLocationValue = deviceLocation?.source === "saved"
    ? `saved:${deviceLocation.id}`
    : deviceLocation ? "device" : areaName;

  useEffect(() => {
    try {
      setSavedLocations(readSavedLocations());
    } catch (error) {
      setSavedLocationError(error.message);
    } finally {
      setSavedLocationsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!savedLocationsReady) return;
    try {
      localStorage.setItem("airwise.savedLocations", JSON.stringify(savedLocations));
      setSavedLocationError("");
    } catch (error) {
      setSavedLocationError("Saved places could not be stored in this browser.");
    }
  }, [savedLocations, savedLocationsReady]);

  useEffect(() => {
    const controller = new AbortController();
    const cacheKey = isCitywide ? "pune-city" : currentLocationId;
    const cached = airCache.current.get(cacheKey);
    // Never keep another location's reading on screen: show this location's
    // cached reading, or nothing until its own data arrives.
    setAir(cached?.air ?? null);
    setWeather(null);
    setIsLoading(!cached);
    setAirError("");
    setWeatherError("");
    if (isCitywide) {
      setAreasLoading(true);
      setAreasError("");
    }
    const airRequest = isCitywide
      ? fetchAreaAirQuality(PUNE_AREAS, controller.signal, true).then((readings) => {
        if (!controller.signal.aborted) {
          setAreaReadings(readings);
          areaReadingsRefreshKey.current = refreshKey;
          setAreasError("");
          setAreasLoading(false);
          readings.forEach((reading, index) => {
            airCache.current.set(locationKey(PUNE_AREAS[index]), { air: reading, cachedAt: Date.now() });
          });
          const aggregated = aggregateAreaReadings(readings);
          airCache.current.set(cacheKey, { air: aggregated, cachedAt: Date.now() });
          setAir(aggregated);
        }
      })
      : fetchAirQuality(location, controller.signal).then((reading) => {
        if (!controller.signal.aborted) {
          airCache.current.set(cacheKey, { air: reading, cachedAt: Date.now() });
          setAir(reading);
        }
      });
    const weatherRequest = fetchWeather(location, controller.signal);
    Promise.allSettled([airRequest, weatherRequest]).then(([airResult, weatherResult]) => {
      if (controller.signal.aborted) return;
      if (airResult.status === "rejected") {
        setAirError(airResult.reason?.message || "Unable to load air quality right now.");
        if (isCitywide) {
          setAreasError(airResult.reason?.message || "Unable to load Pune-wide area readings.");
          setAreasLoading(false);
        }
      }
      if (weatherResult.status === "fulfilled") setWeather(weatherResult.value);
      else setWeatherError(weatherResult.reason?.message || "Unable to load local weather right now.");
      setIsLoading(false);
    });
    const refreshTimer = window.setInterval(() => setRefreshKey((key) => key + 1), 30 * 60 * 1000);
    return () => {
      controller.abort();
      window.clearInterval(refreshTimer);
    };
  }, [location.latitude, location.longitude, currentLocationId, refreshKey, isCitywide]);

  useEffect(() => {
    if (!["Overview", "Neighborhoods"].includes(section) || isCitywide) return undefined;
    if (areaReadings.length === PUNE_AREAS.length && areaReadingsRefreshKey.current === refreshKey) return undefined;
    const controller = new AbortController();
    setAreasLoading(true);
    setAreasError("");
    fetchAreaAirQuality(PUNE_AREAS, controller.signal)
      .then((readings) => {
        if (!controller.signal.aborted) {
          areaReadingsRefreshKey.current = refreshKey;
          setAreaReadings(readings);
        }
        readings.forEach((reading, index) => {
          if (!controller.signal.aborted) {
            airCache.current.set(locationKey(PUNE_AREAS[index]), { air: reading, cachedAt: Date.now() });
          }
        });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setAreasError(error.message || "Unable to load Pune area readings.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setAreasLoading(false);
      });
    return () => controller.abort();
  }, [section, refreshKey, isCitywide, areaReadings.length]);

  function chooseArea(name) {
    locationRequestId.current += 1;
    setIsLocating(false);
    setDeviceLocation(null);
    setAreaName(name);
    setLocationError("");
    setLocationMessage("");
  }

  function toggleComparisonArea(name) {
    setComparisonAreas((current) => current.includes(name)
      ? current.filter((area) => area !== name)
      : [...current, name]);
    setComparisonReport(null);
  }

  function generateComparison() {
    if (!comparisonReady) return;
    setComparisonReport(comparisonReadings.map(({ name, reading }) => ({
      name,
      aqi: Math.round(reading.us_aqi),
    })));
  }

  function chooseLocation(value) {
    if (value === "device") return;
    if (value.startsWith("saved:")) {
      const saved = savedLocations.find((place) => `saved:${place.id}` === value);
      if (saved) {
        locationRequestId.current += 1;
        setIsLocating(false);
        setDeviceLocation({ ...saved, source: "saved" });
        setLocationError("");
        setLocationMessage("");
      }
      return;
    }
    chooseArea(value);
  }

  function saveCurrentLocation() {
    setSavedLocations((places) => places.some((item) => sameSavedPlace(item, currentPlace))
      ? places.filter((item) => !sameSavedPlace(item, currentPlace))
      : [...places, currentPlace]);
  }

  function useDeviceLocation() {
    const requestId = locationRequestId.current + 1;
    locationRequestId.current = requestId;
    setLocationError("");
    setLocationMessage("");
    if (!navigator.geolocation) {
      setLocationError("This browser does not support location access. Choose a Pune area instead.");
      return;
    }
    setIsLocating(true);
    setLocationMessage("Waiting for location permission…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const coordinates = { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy };
        setLocationMessage("Finding a nearby place name…");
        reverseGeocode(coords.latitude, coords.longitude)
          .then(({ label, region, street }) => {
            if (locationRequestId.current !== requestId) return;
            setDeviceLocation({ ...coordinates, label, region, street, source: "device" });
            setLocationMessage(`Using ${label}. Air quality is estimated for a nearby area.`);
            setIsLocating(false);
          })
          .catch(() => {
            if (locationRequestId.current !== requestId) return;
            setDeviceLocation({ ...coordinates, label: "Nearby area", region: "" });
            setLocationMessage("Place name unavailable. Showing an air-quality estimate for your location.");
            setIsLocating(false);
          });
      },
      (error) => {
        if (locationRequestId.current !== requestId) return;
        setIsLocating(false);
        const messages = {
          1: "Location permission was denied. You can choose an area from the list instead.",
          2: "Your location could not be determined. Please try again or choose an area.",
          3: "Location request timed out. Please try again.",
        };
        setLocationMessage("");
        setLocationError(messages[error.code] || "Unable to get your location. Choose an area instead.");
      },
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 },
    );
  }

  function getAreaSuggestions() {
    if (currentAqi == null || goalValue == null) return;
    const areaPlan = generateAreaActionSuggestions(deviceLocation ? locationLabel : areaName, overviewInsight.id);
    setGeneratedSuggestions({
      areaLabel: locationLabel,
      locationId: currentLocationId,
      targetAqi: goalValue,
      currentAqi,
      signalId: overviewInsight.id,
      signalLabel: overviewInsight.label,
      context: areaPlan.context,
      items: areaPlan.items,
    });
    setPlanShareMessage("");
  }

  function createPlanText() {
    if (!hasCurrentSuggestions) throw new Error("Generate current area suggestions before sharing this plan.");
    const gap = Math.max(0, generatedSuggestions.currentAqi - generatedSuggestions.targetAqi);
    const actionLines = generatedSuggestions.items.map((item, index) => [
      `${index + 1}. ${item.title} (${item.category})`,
      `   What to do: ${item.action}`,
      `   Who can lead: ${item.owner}`,
      `   How to track: ${item.measure}`,
    ].join("\n")).join("\n\n");
    return [
      `Airwise area clean-air action plan — ${generatedSuggestions.areaLabel}`,
      new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" }).format(new Date()),
      `Current model estimate: ${generatedSuggestions.currentAqi} US AQI.`,
      `Area target: ${generatedSuggestions.targetAqi} US AQI.`,
      gap === 0
        ? "The latest model estimate is at or below the selected target."
        : `${gap} AQI points separate the current model estimate and target.`,
      "",
        `Area context — ${generatedSuggestions.context.label}:`,
        generatedSuggestions.context.context,
        "This is a planning profile, not a live building, tree-cover, or source inventory. Verify local conditions before acting.",
        "",
        `Main modelled pollutant clue: ${generatedSuggestions.signalLabel}. This clue does not identify the pollution source.`,
      "",
      "Environmental suggestions:",
      actionLines,
      "",
      "Evidence and references:",
      ...AREA_ACTION_SOURCES.map((source) => `- ${source.label}: ${source.url}`),
      "",
      "Important: This is an evidence-informed, rule-based guide—not an AI-generated forecast. The goal gap is a comparison, not a prediction. These actions do not calculate an AQI reduction. The China study evaluated a multi-policy program and its results cannot be transferred as a Pune-area forecast. Verify sources with local evidence and evaluate progress using official monitors; nearby areas may share a broad model estimate.",
      "Data: Open-Meteo CAMS model estimates. https://open-meteo.com/en/docs/air-quality-api",
    ].join("\n");
  }

  function downloadPlan() {
    const file = new Blob([createPlanText()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `airwise-aqi-goal-${locationLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setPlanShareMessage("Your plan has been downloaded. You can print it or attach it to a message.");
  }

  async function sharePlan() {
    const text = createPlanText();
    try {
      if (navigator.share) {
        await navigator.share({ title: `Airwise action plan — ${locationLabel}`, text });
        setPlanShareMessage("Your plan is ready to share.");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setPlanShareMessage("Your plan has been copied. Paste it into a message to share.");
      } else {
        setPlanShareMessage("Sharing isn’t available in this browser. Download the plan to share it.");
      }
    } catch (error) {
      if (error.name !== "AbortError") setPlanShareMessage("Could not share the plan. Try downloading it instead.");
    }
  }

  const displayDate = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date());
  const title = section === "Overview" ? "Pune Air Quality" : section;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand"><div className="brand-mark"><Activity size={19} /></div><span>airwise<span className="brand-dot">.</span></span></div>
        <div className="workspace-switch"><div className="workspace-avatar">PU</div><div><strong>Pune Air Quality</strong></div></div>
        <div className="nav-label">DASHBOARD</div>
        <nav>
          {navigation.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${section === label ? "active" : ""}`} onClick={() => { setSection(label); setMenuOpen(false); }}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="source-card"><div className="source-card-icon"><Cloud size={16} /></div><div><strong>Model-based estimates</strong><span>Not a street-level sensor</span></div></div>
          <div className="profile-button"><div className="profile-avatar"><MapPin size={15} /></div><div><strong>{locationLabel}</strong><span>{[deviceLocation?.street, deviceLocation?.region || "Pune, Maharashtra", deviceLocation?.accuracy ? `GPS ±${Math.round(deviceLocation.accuracy)} m` : ""].filter(Boolean).join(" · ")}</span></div></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu"><Menu size={20} /></button>
          <div className="breadcrumb">Air quality <ChevronRight size={14} /><span>{section}</span></div>
          <div className="topbar-actions">
            <div className={`provider-status ${airError ? "offline" : "live"}`} title="Model estimates update when the provider publishes new runs; this is not a real-time sensor stream.">
              <span className={`provider-dot ${airError ? "offline" : ""}`} />{airError ? "Data unavailable" : "MODEL ESTIMATE"}
            </div>
            <button className="icon-button" onClick={() => setRefreshKey((key) => key + 1)} aria-label="Refresh data" title="Refresh data"><RefreshCw size={16} className={isLoading ? "spin" : ""} /></button>
            <div className="alert-anchor">
              <button className="icon-button notification-button" aria-label="Air quality alert settings" onClick={() => setAlertsOpen(!alertsOpen)}><Bell size={17} /><i /></button>
              {alertsOpen && <div className="alerts-panel">
                <div className="panel-title"><div><Bell size={16} /><strong>Alert threshold</strong></div><button className="icon-button" onClick={() => setAlertsOpen(false)} aria-label="Close alerts"><X size={16} /></button></div>
                <p>Set an AQI level to keep in mind. This dashboard does not send push notifications.</p>
                <label className="threshold-label">Show reminder above <strong>{threshold} AQI</strong></label>
                <input className="threshold-slider" type="range" min="50" max="200" step="10" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} />
                <div className={`alert-confirm ${Number.isFinite(air?.current?.us_aqi) && Math.round(air.current.us_aqi) >= threshold ? "threshold-reached" : ""}`}>
                  <ShieldCheck size={14} />
                  {Number.isFinite(air?.current?.us_aqi)
                    ? Math.round(air.current.us_aqi) >= threshold
                      ? `Current model estimate is above ${threshold} AQI.`
                      : `Current model estimate is below ${threshold} AQI.`
                    : "Waiting for current air-quality data."}
                </div>
              </div>}
            </div>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <div className="eyebrow date-eyebrow">{displayDate.toUpperCase()} <span>·</span> {deviceLocation ? "YOUR AREA" : "PUNE"}</div>
              <h1>{title}</h1>
              <p>{section === "Overview" ? (isCitywide ? "See air quality across Pune and what you can do next." : `Air quality near ${locationLabel}, with simple next steps.`) : section === "Forecast" ? "See when air may be cleaner or more polluted over the next five days." : section === "Neighborhoods" ? "Pick a few Pune areas and compare their air-quality estimates." : `Plan local steps for ${locationLabel}, then share your plan.`}</p>
            </div>
            <div className="welcome-actions">
              <label className="location-select"><MapPin className="location-select-pin" size={15} aria-hidden="true" />
                <select aria-label="Choose Pune area" value={selectedLocationValue} onChange={(event) => chooseLocation(event.target.value)}>
                  {deviceLocation && <option value={deviceLocation.source === "saved" ? `saved:${deviceLocation.id}` : "device"}>{deviceLocation.label}</option>}
                  <option value={PUNE_CITY.name}>Pune city · 12-area average</option>
                  {PUNE_AREAS.map((area) => <option key={area.name} value={area.name}>{area.name}, Pune</option>)}
                  {savedLocations.length > 0 && <optgroup label="Saved places">
                    {savedLocations.map((place) => <option key={place.id} value={`saved:${place.id}`}>{place.label} · saved</option>)}
                  </optgroup>}
                </select>
                <ChevronDown className="location-select-chevron" size={14} aria-hidden="true" />
              </label>
              <button className="button-secondary locate-button" onClick={useDeviceLocation} disabled={isLocating}><LocateFixed size={15} /> {isLocating ? "Finding area…" : "Use my location"}</button>
              <button className={`save-location-button ${isCurrentLocationSaved ? "saved" : ""}`} onClick={saveCurrentLocation} aria-pressed={isCurrentLocationSaved} title={isCurrentLocationSaved ? "Remove from saved places" : "Save this place to your list"}>
                {isCurrentLocationSaved ? <Star size={15} fill="currentColor" /> : <Bookmark size={15} />}
                {isCurrentLocationSaved ? "Saved" : "Save place"}
              </button>
            </div>
          </section>

          {(locationMessage || locationError) && <div className={`location-message ${locationError ? "error" : ""}`} role={locationError ? "alert" : "status"}>{locationError || locationMessage}</div>}
          {savedLocationError && <div className="location-message error" role="alert">{savedLocationError}</div>}

          {isLoading && <div className="loading-card"><span className="loader" /> Loading air-quality and weather data for {locationLabel}…</div>}
          {airError && <div className="error-card" role="alert"><div><strong>Air-quality data could not be loaded</strong><span>{airError}</span></div><button className="button-secondary" onClick={() => setRefreshKey((key) => key + 1)}>Try again</button></div>}

          {!isLoading && air && section === "Overview" && <>
            <section className="aqi-hero">
              <div className="aqi-left">
                <div className="aqi-title-row"><span className="aqi-live-dot" /> CURRENT AIR QUALITY <span className="live-model-badge"><span /> MODEL ESTIMATE</span><span className="info-dot" title="This estimate is based on a regional model, not a sensor at your exact location.">i</span></div>
                <div className="aqi-main"><strong>{Number.isFinite(air.current.us_aqi) ? Math.round(air.current.us_aqi) : "—"}</strong><div><span className={`aqi-status ${category.tone}`}>{category.label}</span><span className="aqi-location"><MapPin size={13} /> {locationLabel} <span>·</span> {freshness}</span></div></div>
                <div className="aqi-message"><span className="message-icon"><Compass size={16} /></span><span>{isCitywide ? `Pune-wide average from ${air.areaCount} area points. Not an official city reading.` : "Estimate for a nearby area, not a sensor at your exact location."}</span></div>
              </div>
              <div className="aqi-right"><div className={`aqi-gauge ${category.tone}`}><div className="gauge-inner"><span>US AQI</span><strong>{Number.isFinite(air.current.us_aqi) ? Math.round(air.current.us_aqi) : "—"}</strong><small>{category.label}</small></div></div><div className="gauge-scale"><span>Good</span><span>Moderate</span><span>Higher</span></div></div>
            </section>

            <AreaHotspotMap
              readings={areaReadings}
              loading={areasLoading}
              activeArea={deviceLocation || isCitywide ? null : areaName}
              onSelectArea={(name) => chooseArea(name)}
            />

            <section className="overview-insights panel-card">
              <div className="section-heading insight-heading">
                <div><span className="eyebrow">AIR QUALITY INSIGHT · {locationLabel.toUpperCase()}</span><h2>What this reading may mean</h2><p>One possible clue and a couple of practical next steps.</p></div>
                <span className={`insight-aqi-badge ${category.tone}`}>{Number.isFinite(air.current.us_aqi) ? `${Math.round(air.current.us_aqi)} · ${category.label}` : "AQI unavailable"}</span>
              </div>
              <div className="overview-response">
                <div className="overview-response-signal"><span>MAIN POLLUTANT CLUE</span><strong>{overviewInsight.label}</strong><b>{Number.isFinite(overviewInsight.componentAqi) ? `Model AQI: ${overviewInsight.componentAqi}` : "Not available"}</b></div>
                <div className="overview-response-copy"><strong>{overviewInsight.summary}</strong><ol>{overviewInsight.actions.slice(0, 2).map((action) => <li key={action}>{action}</li>)}</ol></div>
              </div>
              <div className="insight-next-steps">
                <p><ShieldCheck size={15} /> {overviewInsight.protection}</p>
                <div className="insight-actions">
                  <button className="button-secondary" onClick={() => setSection("Take action")}>Try a local action plan <ArrowRight size={14} /></button>
                </div>
              </div>
              <p className="insight-caveat"><CircleHelp size={13} /> This is a model-based clue, not proof of what caused the pollution. Check local official readings before making decisions.</p>
            </section>

            <div className="panel-card trend-panel overview-trend">
              <div className="section-heading"><div><h2>Air quality trend</h2><p>Recent model history and outlook for {locationLabel}</p></div><span className="model-pill"><Activity size={12} /> CAMS model</span></div>
              <AirHistoryChart hourly={air.hourly} currentTime={currentTime} />
            </div>
            <DataAttribution />
          </>}

          {!isLoading && air && section === "Forecast" && <>
            <ForecastInsights hourly={air.hourly} currentTime={currentTime} locationLabel={locationLabel} />
            <section className="panel-card forecast-panel">
              <div className="section-heading"><div><h2>Next 24 hours</h2><p>Hourly US AQI forecast for {locationLabel}</p></div><span className="model-pill"><Sparkles size={13} /> Atmospheric model</span></div>
              <AirQualityChart hourly={air.hourly} currentTime={currentTime} />
              <div className="forecast-points">{(air.hourly?.time ?? []).map((time, index) => {
                if (time < currentTime || index % 3 !== 0 || !Number.isFinite(air.hourly.us_aqi[index])) return null;
                return <div className="forecast-point-card" key={time}><span>{formatModelHour(time)}</span><strong>{Math.round(air.hourly.us_aqi[index])}</strong><AreaAQIBadge value={air.hourly.us_aqi[index]} /></div>;
              }).filter(Boolean).slice(0, 9)}</div>
            </section>
            <section className="panel-card day-forecast">
              <div className="section-heading"><div><h2>Daily outlook</h2><p>Average and peak hourly US AQI</p></div></div>
              <DailyForecast hourly={air.hourly} currentTime={currentTime} />
            </section>
            <WeatherPanel weather={weather} error={weatherError} />
            <DataAttribution />
          </>}

          {section === "Neighborhoods" && <section className="neighborhood-section">
            <div className="neighborhood-intro"><div className="neighborhood-icon"><MapPin size={19} /></div><div><h2>Explore Pune areas</h2><p>Choose a place to update the dashboard, or select several places below for a comparison.</p></div><span className="area-count">{PUNE_AREAS.length} areas</span></div>
            <div className="city-average-note"><Building2 size={14} /> The Pune city number is an average of area estimates, not an official city reading.</div>
            {areasLoading && <div className="loading-card"><span className="loader" /> Loading current estimates for Pune areas…</div>}
            {areasError && <div className="error-card" role="alert"><div><strong>Area comparison is unavailable</strong><span>{areasError}</span></div><button className="button-secondary" onClick={() => setRefreshKey((key) => key + 1)}>Try again</button></div>}
            {!areasLoading && !areasError && areaReadings.length > 0 && <div className="neighborhood-workspace">
              <div className="area-grid">
                <button className={`area-card city-area-card ${isCitywide ? "selected" : ""}`} onClick={() => chooseArea(PUNE_CITY.name)}>
                  <div className="area-card-top"><span className="area-name"><Building2 size={13} /> Pune city</span><AreaAQIBadge value={areaCitySummary?.current.us_aqi} /></div>
                  <span className="area-data-label">AVERAGE OF {areaCitySummary?.modelGridCount ?? "—"} MODEL POINTS · {PUNE_AREAS.length} AREAS</span>
                  <div className="area-pollutants"><span>PM2.5 <strong>{Number.isFinite(areaCitySummary?.current.pm2_5) ? Number(areaCitySummary.current.pm2_5).toFixed(1) : "—"}</strong></span><span>PM10 <strong>{Number.isFinite(areaCitySummary?.current.pm10) ? Number(areaCitySummary.current.pm10).toFixed(1) : "—"}</strong></span></div>
                  <span className="area-card-action">{isCitywide ? "Selected city view" : "View city average"} <ArrowRight size={13} /></span>
                </button>
                {PUNE_AREAS.map((area, index) => {
                  const reading = areaReadings[index]?.current;
                  const active = !deviceLocation && areaName === area.name;
                  return <button className={`area-card ${active ? "selected" : ""}`} key={area.name} onClick={() => chooseArea(area.name)}>
                    <div className="area-card-top"><span className="area-name">{area.name}</span><AreaAQIBadge value={reading?.us_aqi} /></div>
                    <span className="area-data-label">AQI ESTIMATE · {localTime(reading?.time)}</span>
                    <div className="area-pollutants"><span>PM2.5 <strong>{Number.isFinite(reading?.pm2_5) ? Number(reading.pm2_5).toFixed(1) : "—"}</strong></span><span>PM10 <strong>{Number.isFinite(reading?.pm10) ? Number(reading.pm10).toFixed(1) : "—"}</strong></span></div>
                    <span className="area-card-action">{active ? "Selected area" : "View this area"} <ArrowRight size={13} /></span>
                  </button>;
                })}
              </div>
              <aside className="area-comparison-panel">
                <div className="section-heading"><div><h2>Compare areas</h2><p>Pick at least two, then ask for a simple comparison.</p></div><Activity size={17} /></div>
                <div className="comparison-area-list">
                  {PUNE_AREAS.map((area, index) => {
                    const value = areaReadings[index]?.current?.us_aqi;
                    return <label className="comparison-area-option" key={area.name}>
                      <input type="checkbox" checked={comparisonAreas.includes(area.name)} onChange={() => toggleComparisonArea(area.name)} />
                      <span>{area.name}</span>
                      <strong>{Number.isFinite(value) ? Math.round(value) : "—"}</strong>
                    </label>;
                  })}
                </div>
                <button className="button-primary comparison-generate" disabled={!comparisonReady || areasLoading} onClick={generateComparison}>
                  {areasLoading ? "Loading area readings…" : `Compare ${comparisonAreas.length} selected areas`}
                </button>
                {comparisonAreas.length < 2 && <p className="comparison-note">Choose at least two areas.</p>}
                {comparisonReport && <div className="comparison-report" aria-live="polite">
                  {(() => {
                    const ordered = [...comparisonReport].sort((a, b) => a.aqi - b.aqi);
                    const lowest = ordered[0];
                    const highest = ordered[ordered.length - 1];
                    const difference = highest.aqi - lowest.aqi;
                    return <strong>{difference === 0
                      ? `The selected areas have the same model AQI: ${lowest.aqi}.`
                      : `${lowest.name} has the lowest estimate (${lowest.aqi}); ${highest.name} has the highest (${highest.aqi}), a difference of ${difference} points.`}</strong>;
                  })()}
                  <div className="comparison-report-list">{[...comparisonReport].sort((a, b) => a.aqi - b.aqi).map((result) =>
                    <span key={result.name}>{result.name}<b>{result.aqi} AQI</b></span>)}</div>
                  <p>This is a model snapshot, not an official ranking. Nearby areas can share the same broad estimate.</p>
                </div>}
                <p className="comparison-note">Model estimates can be similar even when locations differ. Check official readings for local decisions.</p>
              </aside>
            </div>}
            <DataAttribution />
          </section>}
          {section === "Take action" && <>
            <section className="action-center-intro"><div className="action-center-mark"><Sparkles size={20} /></div><div><h2>Set an air-quality goal for {locationLabel}</h2><p>Choose an area target, then get environmental suggestions that local teams can review and measure.</p></div></section>
            <section className="panel-card goal-plan-card">
              <div className="goal-plan-heading">
                <div><span className="eyebrow">AREA AIR-QUALITY GOAL</span><h2>What could help move {locationLabel} toward its target?</h2></div>
                <label className="goal-input"><span>Target AQI</span><input aria-label="Target AQI" type="number" min="0" max="500" step="1" value={targetAqi} onChange={(event) => {
                  const value = event.target.value;
                  if (value === "" || (Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 500)) setTargetAqi(value);
                }} /></label>
              </div>
              <div className="goal-gap-summary" aria-live="polite">
                <div><span>Current model estimate</span><strong>{currentAqi ?? "—"} AQI</strong></div>
                <ArrowRight size={17} />
                <div><span>Area target</span><strong>{goalValue ?? "—"} AQI</strong></div>
                <p>{goalValue == null
                  ? "Enter a target AQI for this area."
                  : currentAqi == null
                    ? "Load a current reading to see how far away this goal is."
                  : goalGap === 0
                    ? "The latest model estimate is at or below this target. Check official local readings to see whether that continues."
                    : `The model estimate is ${goalGap} AQI points above this area target. This gap is not a prediction of how much any action will reduce AQI.`}</p>
              </div>
              <div className="suggestion-controls">
                <button className="button-primary" onClick={getAreaSuggestions} disabled={currentAqi == null || goalValue == null}><Sparkles size={15} /> Get suggestions</button>
                <p>Suggestions combine this area's planning context, its modelled pollutant clue, and your target. They are evidence-informed templates, not AI-generated or calculated AQI impacts.</p>
              </div>
              {hasCurrentSuggestions ? <div className="goal-steps area-suggestions" aria-live="polite">
                <div className="area-suggestions-heading"><div><h3>Environmental suggestions for {generatedSuggestions.areaLabel}</h3><p>Area-first actions, followed by the {generatedSuggestions.signalLabel} model clue. Verify sources locally before choosing an intervention.</p></div><span>{generatedSuggestions.items.length} actions</span></div>
                <div className="area-context-card"><span>AREA PLANNING LENS · {generatedSuggestions.context.label.toUpperCase()}</span><p>{generatedSuggestions.context.context}</p><small>These neighborhood profiles are starting hypotheses—not measured building, tree-cover, traffic, or emissions inventories. Verify local conditions and community priorities before acting.</small></div>
                <ol className="area-suggestion-list">{generatedSuggestions.items.map((item, index) => <li key={item.id}>
                  <span className="area-suggestion-number">{String(index + 1).padStart(2, "0")}</span>
                  <div className="area-suggestion-copy">
                    <span className="area-suggestion-category">{item.category}</span>
                    <h4>{item.title}</h4>
                    <p>{item.action}</p>
                    <div className="area-suggestion-meta"><span><strong>Who can lead:</strong> {item.owner}</span><span><strong>Track progress:</strong> {item.measure}</span></div>
                  </div>
                </li>)}</ol>
                <div className="evidence-note"><CircleHelp size={15} /><p><strong>What evidence can—and cannot—tell us:</strong> An evaluation of China’s multi-policy action plan reported 7.25% lower PM2.5 and 10.49% lower coarse-particle concentrations in targeted areas versus comparison areas. These are study results for a package of policies, not expected AQI reductions for Pune or any single action. Trees are a long-term complement; planting counts need a local site survey. <a href="https://pubmed.ncbi.nlm.nih.gov/35738375/" target="_blank" rel="noreferrer">Read the study</a>.</p></div>
                <div className="area-action-sources"><strong>Guidance and examples</strong>{AREA_ACTION_SOURCES.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label}<ArrowRight size={12} /></a>)}</div>
              </div> : <div className="goal-steps suggestion-placeholder"><h3>{generatedSuggestions ? "Suggestions need refreshing" : "Your area action plan will appear here"}</h3><p>{generatedSuggestions ? "The area reading, target, or pollutant clue has changed. Generate a fresh set before sharing." : air ? "Select an area target, then choose Get suggestions to build a shareable environmental action plan." : "Wait for an air-quality reading, then choose Get suggestions."}</p></div>}
              <p className="goal-plan-caveat"><CircleHelp size={14} /> AQI 50 is a US AQI “Good” category boundary, not an India-specific standard. This page does not estimate tree counts, vehicle reductions, or AQI-point changes: those need local source and emissions data plus a validated intervention model.</p>
              <div className="plan-export-actions">
                <button className="button-primary" onClick={sharePlan} disabled={!hasCurrentSuggestions}><Share2 size={15} /> Share area plan</button>
                <button className="button-secondary" onClick={downloadPlan} disabled={!hasCurrentSuggestions}><FileDown size={15} /> Download plan</button>
                <button className="button-secondary" onClick={() => window.print()} disabled={!hasCurrentSuggestions}>Print / save as PDF</button>
              </div>
              {planShareMessage && <p className="plan-share-message" role="status">{planShareMessage}</p>}
            </section>
            {air && <section className="protection-page">
              <div className={`protection-banner ${category.tone}`}>
                <div className="protection-banner-icon"><ShieldCheck size={21} /></div>
                <div><span className="eyebrow">PROTECT YOURSELF · {locationLabel.toUpperCase()}</span><h2>{health.label}</h2><p>{health.summary}</p></div>
                <div className="protection-aqi"><strong>{Number.isFinite(air.current.us_aqi) ? Math.round(air.current.us_aqi) : "—"}</strong><span>US AQI</span></div>
              </div>
              <div className="protection-grid">
                <section className="panel-card protection-card">
                  <div className="section-heading"><div><h2>What you can do today</h2><p>General health guidance for this reading</p></div><ShieldCheck size={18} /></div>
                  <ul className="protection-list">{health.steps.map((step) => <li key={step}><Check size={15} /><span>{step}</span></li>)}</ul>
                  <a className="source-link" href="https://www.airnow.gov/aqi/aqi-basics/" target="_blank" rel="noreferrer">See official AQI health guidance <ArrowRight size={13} /></a>
                </section>
                <section className="panel-card protection-card">
                  <div className="section-heading"><div><h2>Exercise and cleaner air indoors</h2><p>Practical ways to reduce exposure at home</p></div><Wind size={18} /></div>
                  <ul className="protection-list">
                    <li><Check size={15} /><span>When AQI is high, move strenuous exercise indoors or choose a lower-pollution time from the forecast.</span></li>
                    <li><Check size={15} /><span>Keep windows closed when outdoor air is poor, where practical, and choose a cleaner-air room.</span></li>
                    <li><Check size={15} /><span>A correctly sized HEPA air cleaner can reduce particles indoors. Match it to the room size.</span></li>
                    <li><Check size={15} /><span>Avoid air cleaners that intentionally produce ozone. Maintain filters as the manufacturer directs.</span></li>
                  </ul>
                  <span className="personal-note"><CircleHelp size={13} /> Outdoor estimates do not measure indoor air or determine whether a purifier is needed.</span>
                </section>
              </div>
            </section>}
            <section className="take-action-list">
              <div className="section-heading action-list-heading"><div><h2>More ways to help</h2><p>Ideas to discuss with local teams. Check the source before choosing an action.</p></div><label className="action-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find an idea" /></label></div>
              {airError ? <div className="error-card"><div><strong>Suggestions need current data</strong><span>Load air-quality data before recommendations can be shown.</span></div><button className="button-secondary" onClick={() => setRefreshKey((key) => key + 1)}>Refresh</button></div> : <div className="recommendations-list">{visibleRecommendations.map((action) => <ActionCard key={action.id} action={action} />)}</div>}
              {visibleRecommendations.length === 0 && !airError && <div className="empty-search">No suggestions match “{search}”. Try a different search.</div>}
            </section>
            <DataAttribution />
          </>}

          {!air && section === "Forecast" && !isLoading && !airError && <EmptyData onRetry={() => setRefreshKey((key) => key + 1)} />}
          {!air && section === "Take action" && !isLoading && !airError && <div className="loading-card">Load a current reading to see what may be contributing to the air quality and get steps for your area.</div>}
          <footer className="page-footer"><span><span className={`demo-footer-dot ${airError ? "" : "live"}`} /> {airError ? "Air-quality update unavailable" : `Model data · ${freshness}`} <span className="footer-caveat">Not a real-time sensor reading</span></span><a href="https://open-meteo.com/en/docs/air-quality-api" target="_blank" rel="noreferrer">How this estimate is made <ArrowRight size={13} /></a><span>For information only <Leaf size={13} /></span></footer>
        </div>
      </main>
      {menuOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    </div>
  );
}

function WeatherPanel({ weather, error }) {
  if (error) {
    return <div className="panel-card weather-panel weather-error"><div className="section-heading"><div><h2>Local weather</h2><p>Weather data is temporarily unavailable.</p></div><Cloud size={18} /></div><span role="alert">{error}</span></div>;
  }
  if (!weather?.current) return <div className="panel-card weather-panel"><div className="section-heading"><div><h2>Local weather</h2><p>Waiting for current conditions…</p></div><Cloud size={18} /></div></div>;
  const current = weather.current;
  return <div className="panel-card weather-panel">
    <div className="section-heading"><div><h2>Local weather</h2><p>Conditions that influence dispersion</p></div><Cloud size={18} /></div>
    <div className="weather-now"><div className="weather-icon"><Wind size={25} /></div><div><strong>{Math.round(current.temperature_2m)}°</strong><span>{weatherDescription(current.weather_code)}</span></div></div>
    <div className="weather-details"><div><span>WIND</span><strong>{Math.round(current.wind_speed_10m)} km/h</strong></div><div><span>HUMIDITY</span><strong>{Math.round(current.relative_humidity_2m)}%</strong></div><div><span>WIND DIRECTION</span><strong>{Math.round(current.wind_direction_10m)}°</strong></div></div>
    <p className="weather-footnote">Weather model · {current.time?.split("T")[1] || "Current conditions"} local time</p>
  </div>;
}

function DailyForecast({ hourly, currentTime }) {
  const days = useMemo(() => {
    if (!hourly?.time) return [];
    const grouped = new Map();
    hourly.time.forEach((time, index) => {
      const value = hourly.us_aqi?.[index];
      if (time < currentTime || !Number.isFinite(value)) return;
      const date = time.slice(0, 10);
      const group = grouped.get(date) ?? [];
      group.push(value);
      grouped.set(date, group);
    });
    return [...grouped.entries()].map(([date, values]) => ({
      date,
      average: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
      peak: Math.round(Math.max(...values)),
    }));
  }, [hourly, currentTime]);
  const peak = Math.max(1, ...days.map(({ peak: value }) => value));
  if (days.length === 0) return <div className="chart-empty">Daily outlook is not available yet.</div>;
  return <div className="daily-forecast-grid">{days.map((day) => <div className="daily-forecast-card" key={day.date}>
    <span>{new Date(`${day.date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric" })}</span>
    <div className="daily-bar-track"><i style={{ height: `${Math.max(8, (day.peak / peak) * 100)}%` }} /></div>
    <strong>{day.average} <small>avg</small></strong><span className="daily-peak">Peak {day.peak}</span>
    <span className={`daily-category ${aqiCategory(day.peak).tone}`}>{aqiCategory(day.peak).label}</span>
  </div>)}</div>;
}

function DataAttribution() {
  return <div className="data-attribution"><InfoMark /> <span>Air quality and weather are model estimates from <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> (CAMS). Area names use <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap data</a>. Resolution is regional, not street-level; nearby areas may share a grid cell. This is not a substitute for official monitoring or health advice.</span></div>;
}

function InfoMark() {
  return <CircleHelp size={14} />;
}

function EmptyData({ onRetry }) {
  return <div className="empty-data"><Cloud size={24} /><strong>Forecast data is not available yet</strong><button className="button-secondary" onClick={onRetry}>Try again</button></div>;
}

export default App;
