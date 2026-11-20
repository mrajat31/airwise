import { ArrowRight } from "lucide-react";
import { AqiHero } from "../components/AqiHero.jsx";
import { AreaMap } from "../components/AreaMap.jsx";
import { TrendChart } from "../components/charts.jsx";
import { HourlyStrip, InsightPanel, PollutantGrid } from "../components/panels.jsx";
import { Card, CardHeader, DataAttribution } from "../components/ui.jsx";

export function OverviewView({
  air, locationLabel, freshness, outlook, insight, isCitywide,
  areaReadings, areasLoading, activeArea, onSelectArea, onNavigate,
}) {
  return (
    <div className="view">
      <AqiHero air={air} locationLabel={locationLabel} freshness={freshness} outlook={outlook} insight={insight} isCitywide={isCitywide} />

      <div className="grid grid-2">
        <Card className="next-hours-card">
          <CardHeader
            title="Next 24 hours"
            subtitle="US AQI every three hours"
            action={<button type="button" className="link-button" onClick={() => onNavigate("Forecast")}>Full forecast <ArrowRight size={15} aria-hidden="true" /></button>}
          />
          <HourlyStrip hourly={air.hourly} currentTime={air.current?.time} />
        </Card>
        <PollutantGrid current={air.current} />
      </div>

      <div className="grid grid-2 grid-wide-left">
        <AreaMap readings={areaReadings} loading={areasLoading} activeArea={activeArea} onSelectArea={onSelectArea} />
        <InsightPanel insight={insight} onPlan={() => onNavigate("Take action")} />
      </div>

      <Card className="trend-card">
        <CardHeader title="Trend" subtitle={`Past 7 days and 5-day outlook for ${locationLabel}`} />
        <TrendChart hourly={air.hourly} currentTime={air.current?.time} />
      </Card>
      <DataAttribution />
    </div>
  );
}
