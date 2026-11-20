import { ArrowRight, Building2, Scale } from "lucide-react";
import { PUNE_AREAS } from "../airQuality.js";
import { formatNumber, localTimeShort, roundedAqi } from "../lib/format.js";
import { AqiBadge, Card, CardHeader, DataAttribution, ErrorNotice, LoadingNotice } from "../components/ui.jsx";

function AreaCard({ name, reading, selected, onSelect, icon: Icon, caption }) {
  return (
    <button type="button" className={`area-card ${selected ? "selected" : ""}`} onClick={onSelect} aria-pressed={selected}>
      <span className="area-card-top">
        <span className="area-card-name">{Icon && <Icon size={15} aria-hidden="true" />}{name}</span>
        <AqiBadge value={reading?.us_aqi} showLabel />
      </span>
      <span className="area-card-caption">{caption}</span>
      <span className="area-card-stats">
        <span>PM2.5 <b>{formatNumber(reading?.pm2_5, 1)}</b></span>
        <span>PM10 <b>{formatNumber(reading?.pm10, 1)}</b></span>
      </span>
      <span className="area-card-action">{selected ? "Selected" : "View area"} <ArrowRight size={14} aria-hidden="true" /></span>
    </button>
  );
}

function ComparisonResult({ report }) {
  const ordered = [...report].sort((a, b) => a.aqi - b.aqi);
  const lowest = ordered[0];
  const highest = ordered[ordered.length - 1];
  const difference = highest.aqi - lowest.aqi;
  const maximum = Math.max(...ordered.map((item) => item.aqi), 1);
  return (
    <div className="comparison-result" aria-live="polite">
      <strong>
        {difference === 0
          ? `All selected areas share the same model AQI: ${lowest.aqi}.`
          : `${lowest.name} is lowest (${lowest.aqi}); ${highest.name} is highest (${highest.aqi}) — ${difference} points apart.`}
      </strong>
      <ul>
        {ordered.map((item) => (
          <li key={item.name}>
            <span>{item.name}</span>
            <span className="comparison-bar" aria-hidden="true"><i style={{ width: `${(item.aqi / maximum) * 100}%` }} /></span>
            <AqiBadge value={item.aqi} size="sm" />
          </li>
        ))}
      </ul>
      <p>A model snapshot, not an official ranking. Nearby areas can share the same broad estimate.</p>
    </div>
  );
}

export function NeighborhoodsView({
  areaReadings, areasLoading, areasError, citySummary, isCitywide, activeArea, onSelectArea, onSelectCity, onRetry,
  comparisonAreas, onToggleComparison, comparisonReady, onCompare, comparisonReport,
}) {
  const hasReadings = !areasLoading && !areasError && areaReadings.length > 0;
  return (
    <div className="view">
      {areasLoading && <LoadingNotice>Loading current estimates for Pune areas…</LoadingNotice>}
      {areasError && <ErrorNotice title="Area comparison is unavailable" message={areasError} onRetry={onRetry} />}
      {hasReadings && (
        <div className="neighborhood-layout">
          <div className="area-grid">
            <AreaCard
              name="Pune city"
              icon={Building2}
              reading={citySummary?.current}
              selected={isCitywide}
              onSelect={onSelectCity}
              caption={`Average of ${citySummary?.modelGridCount ?? "—"} model points · not an official reading`}
            />
            {PUNE_AREAS.map((area, index) => (
              <AreaCard
                key={area.name}
                name={area.name}
                reading={areaReadings[index]?.current}
                selected={activeArea === area.name}
                onSelect={() => onSelectArea(area.name)}
                caption={`Model time ${localTimeShort(areaReadings[index]?.current?.time)}`}
              />
            ))}
          </div>
          <Card as="aside" className="compare-card">
            <CardHeader title="Compare areas" subtitle="Pick two or more areas." action={<Scale size={18} aria-hidden="true" />} />
            <fieldset className="compare-options">
              <legend className="visually-hidden">Areas to compare</legend>
              {PUNE_AREAS.map((area, index) => (
                <label key={area.name} className="compare-option">
                  <input type="checkbox" checked={comparisonAreas.includes(area.name)} onChange={() => onToggleComparison(area.name)} />
                  <span>{area.name}</span>
                  <b>{roundedAqi(areaReadings[index]?.current?.us_aqi) ?? "—"}</b>
                </label>
              ))}
            </fieldset>
            <button type="button" className="button button-primary button-block" disabled={!comparisonReady} onClick={onCompare}>
              Compare {comparisonAreas.length} areas
            </button>
            {comparisonAreas.length < 2 && <p className="muted small">Choose at least two areas.</p>}
            {comparisonReport && <ComparisonResult report={comparisonReport} />}
          </Card>
        </div>
      )}
      <DataAttribution />
    </div>
  );
}
