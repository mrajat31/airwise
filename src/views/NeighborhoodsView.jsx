import { ArrowRight, Building2, Scale } from "lucide-react";
import { PUNE_AREAS } from "../airQuality.js";
import { formatNumber, localTimeShort, roundedAqi } from "../lib/format.js";
import { AqiBadge, Card, CardHeader, DataAttribution, ErrorNotice, LoadingNotice } from "../components/ui.jsx";
import { useI18n } from "../i18n/index.jsx";
import { cellSiblings, sharedCellGroups } from "../lib/cells.js";

/** "Identical estimate to Warje", or a count when the list would be long. */
function describeSiblings(t, siblings) {
  if (siblings.length === 0) return null;
  return siblings.length <= 2
    ? t("areas.sameCell", { areas: siblings.join(", ") })
    : t("areas.sameCellMany", { count: siblings.length });
}

function AreaCard({ name, reading, selected, onSelect, icon: Icon, caption, captionTitle }) {
  const { t } = useI18n();
  return (
    <button type="button" className={`area-card ${selected ? "selected" : ""}`} onClick={onSelect} aria-pressed={selected}>
      <span className="area-card-top">
        <span className="area-card-name">{Icon && <Icon size={15} aria-hidden="true" />}{name}</span>
        <AqiBadge value={reading?.us_aqi} showLabel />
      </span>
      <span className="area-card-caption" title={captionTitle}>{caption}</span>
      <span className="area-card-stats">
        <span>PM2.5 <b>{formatNumber(reading?.pm2_5, 1)}</b></span>
        <span>PM10 <b>{formatNumber(reading?.pm10, 1)}</b></span>
      </span>
      <span className="area-card-action">{t(selected ? "areas.selected" : "areas.view")} <ArrowRight size={14} aria-hidden="true" /></span>
    </button>
  );
}

function ComparisonResult({ report, cells }) {
  const { t } = useI18n();
  const ordered = [...report].sort((a, b) => a.aqi - b.aqi);
  const lowest = ordered[0];
  const highest = ordered[ordered.length - 1];
  const difference = highest.aqi - lowest.aqi;
  const maximum = Math.max(...ordered.map((item) => item.aqi), 1);
  return (
    <div className="comparison-result" aria-live="polite">
      <strong>
        {difference === 0
          ? t("compare.same", { aqi: lowest.aqi })
          : t("compare.diff", { low: lowest.name, lowAqi: lowest.aqi, high: highest.name, highAqi: highest.aqi, diff: difference })}
      </strong>
      {sharedCellGroups(cells, report.map((item) => item.name)).map((group) => (
        <p key={group.join()} className="comparison-cell-note">{t("compare.sharedCell", { areas: group.join(", ") })}</p>
      ))}
      <ul>
        {ordered.map((item) => (
          <li key={item.name}>
            <span>{item.name}</span>
            <span className="comparison-bar" aria-hidden="true"><i style={{ width: `${(item.aqi / maximum) * 100}%` }} /></span>
            <AqiBadge value={item.aqi} size="sm" />
          </li>
        ))}
      </ul>
      <p>{t("compare.note")}</p>
    </div>
  );
}

export function NeighborhoodsView({
  areaReadings, areasLoading, areasError, citySummary, isCitywide, activeArea, onSelectArea, onSelectCity, onRetry,
  comparisonAreas, onToggleComparison, comparisonReady, onCompare, comparisonReport, cells,
}) {
  const { t } = useI18n();
  const hasReadings = !areasLoading && !areasError && areaReadings.length > 0;
  return (
    <div className="view">
      {areasLoading && <LoadingNotice>{t("areas.loading")}</LoadingNotice>}
      {areasError && <ErrorNotice title={t("areas.error")} message={areasError} onRetry={onRetry} />}
      {hasReadings && (
        <div className="neighborhood-layout">
          <div className="area-grid">
            <AreaCard
              name={t("areas.city")}
              icon={Building2}
              reading={citySummary?.current}
              selected={isCitywide}
              onSelect={onSelectCity}
              caption={t("areas.cityCaption", { count: citySummary?.areaCount ?? "—" })}
            />
            {PUNE_AREAS.map((area, index) => (
              <AreaCard
                key={area.name}
                name={area.name}
                reading={areaReadings[index]?.current}
                selected={activeArea === area.name}
                onSelect={() => onSelectArea(area.name)}
                caption={describeSiblings(t, cellSiblings(cells, area.name))
                  ?? t("areas.modelTime", { time: localTimeShort(areaReadings[index]?.current?.time) })}
                captionTitle={cellSiblings(cells, area.name).join(", ") || undefined}
              />
            ))}
          </div>
          <Card as="aside" className="compare-card">
            <CardHeader title={t("compare.title")} subtitle={t("compare.sub")} action={<Scale size={18} aria-hidden="true" />} />
            <fieldset className="compare-options">
              <legend className="visually-hidden">{t("compare.legend")}</legend>
              {PUNE_AREAS.map((area, index) => (
                <label key={area.name} className="compare-option">
                  <input type="checkbox" checked={comparisonAreas.includes(area.name)} onChange={() => onToggleComparison(area.name)} />
                  <span>{area.name}</span>
                  <b>{roundedAqi(areaReadings[index]?.current?.us_aqi) ?? "—"}</b>
                </label>
              ))}
            </fieldset>
            <button type="button" className="button button-primary button-block" disabled={!comparisonReady} onClick={onCompare}>
              {t("compare.button", { count: comparisonAreas.length })}
            </button>
            {comparisonAreas.length < 2 && <p className="muted small">{t("compare.min")}</p>}
            {comparisonReport && <ComparisonResult report={comparisonReport} cells={cells} />}
          </Card>
        </div>
      )}
      <DataAttribution />
    </div>
  );
}
