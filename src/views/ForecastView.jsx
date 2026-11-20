import { Sun, TrendingUp } from "lucide-react";
import { ForecastChart } from "../components/charts.jsx";
import { DailyForecast, HourlyStrip, WeatherPanel } from "../components/panels.jsx";
import { Card, CardHeader, DataAttribution } from "../components/ui.jsx";
import { formatModelHour } from "../lib/format.js";

function OutlookCard({ icon: Icon, label, time, detail, tone }) {
  return (
    <div className={`outlook-card tone-${tone}`}>
      <span className="outlook-icon"><Icon size={18} aria-hidden="true" /></span>
      <span className="outlook-label">{label}</span>
      <strong>{time}</strong>
      <small>{detail}</small>
    </div>
  );
}

export function ForecastView({ air, weather, weatherError, locationLabel, outlook }) {
  return (
    <div className="view">
      {outlook && (
        <div className="grid grid-2 outlook-grid" aria-label={`Next 24 hours in ${locationLabel}`}>
          <OutlookCard
            icon={Sun}
            label="Best time for outdoor activity"
            time={formatModelHour(outlook.cleanWindowTime)}
            detail={`3-hour window averaging about ${outlook.cleanWindowAqi} AQI · ${outlook.cleanWindowCategory.label}`}
            tone={outlook.cleanWindowCategory.tone}
          />
          <OutlookCard
            icon={TrendingUp}
            label="Air may be most polluted"
            time={formatModelHour(outlook.peakTime)}
            detail={`Peak around ${outlook.peak} AQI · ${outlook.peakCategory.label}`}
            tone={outlook.peakCategory.tone}
          />
        </div>
      )}
      <Card>
        <CardHeader title="Hour by hour" subtitle={`US AQI forecast for ${locationLabel}, next 24 hours`} />
        <ForecastChart hourly={air.hourly} currentTime={air.current?.time} />
        <HourlyStrip hourly={air.hourly} currentTime={air.current?.time} count={8} />
        <p className="card-footnote">Rule-based summary of model forecasts. Forecasts change — follow local health advice when air is poor.</p>
      </Card>
      <div className="grid grid-2">
        <Card>
          <CardHeader title="Daily outlook" subtitle="Average and peak hourly US AQI" />
          <DailyForecast hourly={air.hourly} currentTime={air.current?.time} />
        </Card>
        <WeatherPanel weather={weather} error={weatherError} />
      </div>
      <DataAttribution />
    </div>
  );
}
