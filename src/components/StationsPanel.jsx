import { RadioTower } from "lucide-react";
import { useI18n } from "../i18n/index.jsx";
import { isStale } from "../lib/stations.js";
import { AqiBadge, Card, CardHeader } from "./ui.jsx";

const POLLUTANT_NAMES = { pm25: "PM2.5", pm10: "PM10" };

function formatStationTime(iso, locale) {
  const date = new Date(iso ?? "");
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(date);
}

/** Nearest official monitors beside the model estimate for the selected place. */
export function StationsPanel({ stations, modelAqi, source, now = Date.now() }) {
  const { t, locale } = useI18n();
  return (
    <Card className="stations-card">
      <CardHeader title={t("st.title")} subtitle={t("st.sub")} action={<RadioTower size={18} aria-hidden="true" />} />
      <div className="station-model">
        <span>{t("st.modelHere")}</span>
        <AqiBadge value={modelAqi} showLabel />
      </div>
      {stations.length === 0 ? (
        <p className="muted">{t("st.none")}</p>
      ) : (
        <ul className="station-list">
          {stations.map((station) => {
            const stale = isStale(station, now);
            return (
              <li key={station.id ?? station.name} className={stale ? "is-stale" : ""}>
                <div className="station-text">
                  <strong>{station.name}</strong>
                  <span>
                    {[station.provider, t("st.distance", { km: station.distanceKm.toFixed(1) }), t("st.updated", { time: formatStationTime(station.updatedAt, locale) })].filter(Boolean).join(" · ")}
                  </span>
                  <small>
                    {t("st.basis", { pollutant: POLLUTANT_NAMES[station.aqiPollutant] ?? station.aqiPollutant })}
                    {stale && <> · <b>{t("st.stale")}</b></>}
                  </small>
                </div>
                <AqiBadge value={station.aqi} size="sm" />
              </li>
            );
          })}
        </ul>
      )}
      <p className="card-footnote">{t("st.note", { source: source ?? "OpenAQ" })}</p>
    </Card>
  );
}
