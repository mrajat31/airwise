import { ArrowRight } from "lucide-react";
import { AqiHero } from "../components/AqiHero.jsx";
import { AreaMap } from "../components/AreaMap.jsx";
import { TrendChart } from "../components/charts.jsx";
import { SurveyCard } from "../components/notices.jsx";
import { HourlyStrip, InsightPanel, PollutantGrid } from "../components/panels.jsx";
import { StationsPanel } from "../components/StationsPanel.jsx";
import { Card, CardHeader, DataAttribution } from "../components/ui.jsx";
import { useI18n } from "../i18n/index.jsx";

export function OverviewView({
  air, locationLabel, freshness, outlook, insight, isCitywide,
  areaReadings, areasLoading, activeArea, onSelectArea, onNavigate,
  activity, onActivityChange, bestTime, cells, sharedWith, displayDate, title, onShared,
  stations, nearbyStations, survey, now,
}) {
  const { t } = useI18n();
  return (
    <div className="view">
      <AqiHero
        air={air}
        locationLabel={locationLabel}
        freshness={freshness}
        outlook={outlook}
        insight={insight}
        isCitywide={isCitywide}
        activity={activity}
        onActivityChange={onActivityChange}
        bestTime={bestTime}
        sharedWith={sharedWith}
        displayDate={displayDate}
        title={title}
        onShared={onShared}
      />

      {survey?.visible && <SurveyCard answered={survey.answered} onAnswer={survey.answer} onDismiss={survey.dismiss} />}

      <div className="grid grid-2">
        <Card className="next-hours-card">
          <CardHeader
            title={t("ov.next24")}
            subtitle={t("ov.next24Sub")}
            action={<button type="button" className="link-button" onClick={() => onNavigate("Forecast")}>{t("ov.fullForecast")} <ArrowRight size={15} aria-hidden="true" /></button>}
          />
          <HourlyStrip hourly={air.hourly} currentTime={air.current?.time} />
        </Card>
        <PollutantGrid current={air.current} />
      </div>

      <div className="grid grid-2 grid-wide-left">
        <AreaMap
          readings={areaReadings}
          loading={areasLoading}
          activeArea={activeArea}
          onSelectArea={onSelectArea}
          cells={cells}
          stations={stations?.stations ?? []}
        />
        {stations ? (
          <StationsPanel stations={nearbyStations} modelAqi={air.current?.us_aqi} source={stations.source} now={now} />
        ) : (
          <InsightPanel insight={insight} onPlan={() => onNavigate("Take action")} />
        )}
      </div>

      {stations && <InsightPanel insight={insight} onPlan={() => onNavigate("Take action")} />}

      <Card className="trend-card">
        <CardHeader title={t("ov.trend")} subtitle={t("ov.trendSub", { place: locationLabel })} />
        <TrendChart hourly={air.hourly} currentTime={air.current?.time} />
      </Card>
      <DataAttribution />
    </div>
  );
}
