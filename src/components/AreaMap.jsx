import { MapPin } from "lucide-react";
import { PUNE_AREAS, aqiCategory } from "../airQuality.js";
import { roundedAqi } from "../lib/format.js";
import { AqiBadge, Card, CardHeader, Pill } from "./ui.jsx";

const MAP_WIDTH = 400;
const MAP_HEIGHT = 250;
const bounds = {
  minLat: Math.min(...PUNE_AREAS.map((area) => area.latitude)),
  maxLat: Math.max(...PUNE_AREAS.map((area) => area.latitude)),
  minLon: Math.min(...PUNE_AREAS.map((area) => area.longitude)),
  maxLon: Math.max(...PUNE_AREAS.map((area) => area.longitude)),
};

function project(area) {
  return {
    x: 40 + ((area.longitude - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * (MAP_WIDTH - 80),
    y: 28 + ((bounds.maxLat - area.latitude) / (bounds.maxLat - bounds.minLat)) * (MAP_HEIGHT - 66),
  };
}

// Kothrud and Warje sit close together; nudge their labels apart.
const LABEL_OFFSETS = { Kothrud: { x: -22, valueY: -12, labelY: 4 }, Warje: { x: 14, valueY: -13, labelY: 24 } };

export function AreaMap({ readings, loading, activeArea, onSelectArea }) {
  const points = PUNE_AREAS.map((area, index) => ({ ...area, value: readings[index]?.current?.us_aqi }));
  return (
    <Card className="area-map-card">
      <CardHeader
        title="Air quality around Pune"
        subtitle="Tap an area to see its estimate and outlook."
        action={<Pill icon={MapPin}>12 areas</Pill>}
      />
      <div className="area-map">
        <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="group" aria-label="Pune areas by modelled US AQI">
          <defs>
            <pattern id="map-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" className="map-grid-line" /></pattern>
          </defs>
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#map-grid)" />
          {points.map((area) => {
            const { x, y } = project(area);
            const offset = LABEL_OFFSETS[area.name] ?? { x: 0, valueY: -13, labelY: 23 };
            const selected = activeArea === area.name;
            const category = aqiCategory(area.value);
            const rounded = roundedAqi(area.value);
            const select = () => onSelectArea(area.name);
            return (
              <g
                key={area.name}
                className={`map-point tone-${category.tone} ${selected ? "selected" : ""}`}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                aria-label={`${area.name}: ${rounded == null ? "reading unavailable" : `${rounded} US AQI, ${category.label}`}`}
                onClick={select}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    select();
                  }
                }}
              >
                <circle cx={x} cy={y} r={selected ? 17 : 13} className="map-halo" />
                <circle cx={x} cy={y} r={selected ? 8 : 6} className="map-dot" />
                <text x={x + offset.x} y={y + offset.valueY} textAnchor="middle" className="map-value">{rounded ?? "—"}</text>
                <text x={x + offset.x} y={y + offset.labelY} textAnchor="middle" className="map-label">{area.name}</text>
              </g>
            );
          })}
        </svg>
        {loading && <div className="map-loading" role="status">Refreshing area estimates…</div>}
      </div>
      <ul className="map-legend" aria-label="AQI colour key">
        <li className="tone-good"><i />Good</li>
        <li className="tone-moderate"><i />Moderate</li>
        <li className="tone-sensitive"><i />Sensitive groups</li>
        <li className="tone-unhealthy"><i />Unhealthy+</li>
      </ul>
      <div className="area-chips" aria-label="Choose a Pune area">
        {points.map((area) => (
          <button
            type="button"
            key={area.name}
            className={`area-chip ${activeArea === area.name ? "selected" : ""}`}
            aria-pressed={activeArea === area.name}
            onClick={() => onSelectArea(area.name)}
          >
            <span>{area.name}</span>
            <AqiBadge value={area.value} size="sm" />
          </button>
        ))}
      </div>
      <p className="card-footnote">Model estimates, not street monitors. Nearby areas can share a value because they fall in the same model grid cell.</p>
    </Card>
  );
}
