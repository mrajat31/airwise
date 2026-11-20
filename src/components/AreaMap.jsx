import { MapPin } from "lucide-react";
import { PUNE_AREAS, aqiCategory } from "../airQuality.js";
import { useI18n } from "../i18n/index.jsx";
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

function project(point) {
  return {
    x: 40 + ((point.longitude - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * (MAP_WIDTH - 80),
    y: 28 + ((bounds.maxLat - point.latitude) / (bounds.maxLat - bounds.minLat)) * (MAP_HEIGHT - 66),
  };
}

function onMap({ x, y }) {
  return x >= 8 && x <= MAP_WIDTH - 8 && y >= 8 && y <= MAP_HEIGHT - 8;
}

// Kothrud and Warje sit close together; nudge their labels apart.
const LABEL_OFFSETS = { Kothrud: { x: -22, valueY: -12, labelY: 4 }, Warje: { x: 14, valueY: -13, labelY: 24 } };

export function AreaMap({ readings, loading, activeArea, onSelectArea, cells, stations = [] }) {
  const { t } = useI18n();
  const points = PUNE_AREAS.map((area, index) => ({ ...area, value: readings[index]?.current?.us_aqi }));
  const stationPoints = stations
    .map((station) => ({ ...station, ...project(station) }))
    .filter(onMap);
  const cellCount = cells?.cellCount;
  return (
    <Card className="area-map-card">
      <CardHeader
        title={t("map.title")}
        subtitle={t("map.sub")}
        action={<Pill icon={MapPin}>{cellCount ? t("map.pillCells", { cells: cellCount }) : t("map.pill")}</Pill>}
      />
      <div className="area-map">
        <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="group" aria-label={t("map.svgLabel")}>
          <defs>
            <pattern id="map-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" className="map-grid-line" /></pattern>
          </defs>
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#map-grid)" />
          {stationPoints.map((station) => {
            const category = aqiCategory(station.aqi);
            return (
              <g key={station.id ?? station.name} className={`map-station tone-${category.tone}`}>
                <title>{`${t("map.station")}: ${station.name} · ${roundedAqi(station.aqi) ?? "—"} AQI`}</title>
                <rect x={station.x - 5} y={station.y - 5} width="10" height="10" rx="2" transform={`rotate(45 ${station.x} ${station.y})`} />
              </g>
            );
          })}
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
                aria-label={`${area.name}: ${rounded == null ? t("map.unavailable") : `${rounded} US AQI, ${t(`aqi.${category.tone}`)}`}`}
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
        {loading && <div className="map-loading" role="status">{t("map.loading")}</div>}
      </div>
      <ul className="map-legend" aria-label={t("map.legend")}>
        <li className="tone-good"><i />{t("aqi.good")}</li>
        <li className="tone-moderate"><i />{t("aqi.moderate")}</li>
        <li className="tone-sensitive"><i />{t("aqi.sensitive")}</li>
        <li className="tone-unhealthy"><i />{t("map.legendUnhealthy")}</li>
        {stationPoints.length > 0 && <li className="legend-station"><i />{t("map.station")}</li>}
      </ul>
      <div className="area-chips" aria-label={t("map.choose")} role="group">
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
      <p className="card-footnote">{cellCount ? t("map.footCells", { cells: cellCount }) : t("map.foot")}</p>
    </Card>
  );
}
