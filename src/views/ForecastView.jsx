import { Sun, TrendingUp } from "lucide-react";
import { ActivityPicker, describeWindow } from "../components/AqiHero.jsx";
import { ForecastChart } from "../components/charts.jsx";
import { DailyForecast, HourlyStrip, WeatherPanel } from "../components/panels.jsx";
import { Card, CardHeader, DataAttribution } from "../components/ui.jsx";
import { useI18n } from "../i18n/index.jsx";
import { formatModelHour } from "../lib/format.js";

function OutlookCard({ icon: Icon, label, time, detail, tone, children }) {
  return (
    <div className={`outlook-card tone-${tone}`}>
      <span className="outlook-icon"><Icon size={18} aria-hidden="true" /></span>
      <span className="outlook-label">{label}</span>
      <strong>{time}</strong>
      <small>{detail}</small>
      {children}
    </div>
  );
}

export function ForecastView({ air, weather, weatherError, locationLabel, outlook, activity, onActivityChange, bestTime }) {
  const { t } = useI18n();
  const best = describeWindow(t, bestTime);
  return (
    <div className="view">
      {outlook && (
        <div className="grid grid-2 outlook-grid" aria-label={t("hero.glance")}>
          <OutlookCard
            icon={Sun}
            label={t(`best.${activity}`)}
            time={best?.value ?? "—"}
            detail={best?.detail ?? t("best.unavailable")}
            tone={bestTime?.category.tone ?? "neutral"}
          >
            <ActivityPicker value={activity} onChange={onActivityChange} />
          </OutlookCard>
          <OutlookCard
            icon={TrendingUp}
            label={t("fc.peakLabel")}
            time={formatModelHour(outlook.peakTime)}
            detail={t("fc.peakDetail", { aqi: outlook.peak, category: t(`aqi.${outlook.peakCategory.tone}`) })}
            tone={outlook.peakCategory.tone}
          />
        </div>
      )}
      <Card>
        <CardHeader title={t("fc.hourly")} subtitle={t("fc.hourlySub", { place: locationLabel })} />
        <ForecastChart hourly={air.hourly} currentTime={air.current?.time} />
        <HourlyStrip hourly={air.hourly} currentTime={air.current?.time} count={8} />
        <p className="card-footnote">{t("fc.note")}</p>
      </Card>
      <div className="grid grid-2">
        <Card>
          <CardHeader title={t("fc.daily")} subtitle={t("fc.dailySub")} />
          <DailyForecast hourly={air.hourly} currentTime={air.current?.time} />
        </Card>
        <WeatherPanel weather={weather} error={weatherError} />
      </div>
      <DataAttribution />
    </div>
  );
}
