import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  aggregateAreaReadings,
  fetchAirQuality,
  fetchAreaAirQuality,
  fetchWeather,
  PUNE_AREAS,
  PUNE_CITY,
  reverseGeocode,
} from "./airQuality.js";
import { generateAreaActionSuggestions } from "./areaActionPlan.js";
import { LocationBar, SECTIONS, Sidebar, TabBar, TopBar } from "./components/Shell.jsx";
import { ErrorNotice, LoadingNotice, Skeleton } from "./components/ui.jsx";
import { useNow } from "./hooks/useNow.js";
import { useTheme } from "./hooks/useTheme.js";
import { formatFreshness, roundedAqi } from "./lib/format.js";
import { forecastOutlook, upcomingHours } from "./lib/forecast.js";
import { getOverviewInsight, makeRecommendations } from "./lib/insights.js";
import { locationKey, parseSavedLocations, SAVED_PLACES_KEY, sameSavedPlace } from "./lib/places.js";
import { buildPlanText, planFileName } from "./lib/plan.js";
import { ForecastView } from "./views/ForecastView.jsx";
import { NeighborhoodsView } from "./views/NeighborhoodsView.jsx";
import { OverviewView } from "./views/OverviewView.jsx";
import { TakeActionView } from "./views/TakeActionView.jsx";

const AUTO_REFRESH_MS = 30 * 60 * 1000;

const INTROS = {
  Overview: (label, citywide) => (citywide ? "How the air is across Pune right now, and the best time to be outside." : `How the air is near ${label} right now, and the best time to be outside.`),
  Forecast: () => "When the air may be cleaner or more polluted over the next five days.",
  Neighborhoods: () => "Compare model estimates across Pune areas.",
  "Take action": (label) => `Protect yourself today and plan local steps for ${label}.`,
};

function App() {
  const { theme, toggleTheme } = useTheme();
  const now = useNow();
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
  const [plan, setPlan] = useState(null);
  const [search, setSearch] = useState("");
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
  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  const comparisonReadings = comparisonAreas.map((name) => ({
    name,
    reading: areaReadings[PUNE_AREAS.findIndex((area) => area.name === name)]?.current,
  }));
  const comparisonReady = !areasLoading && comparisonReadings.length >= 2
    && comparisonReadings.every(({ reading }) => Number.isFinite(reading?.us_aqi));
  const citySummary = useMemo(
    () => (areaReadings.length === PUNE_AREAS.length ? aggregateAreaReadings(areaReadings) : null),
    [areaReadings],
  );
  const recommendations = useMemo(() => makeRecommendations(air), [air]);
  const insight = useMemo(() => getOverviewInsight(air), [air]);
  const outlook = useMemo(() => forecastOutlook(upcomingHours(air?.hourly, air?.current?.time, 24)), [air]);
  const currentAqi = roundedAqi(air?.current?.us_aqi);
  const freshness = formatFreshness(air?.current?.time, air?.utc_offset_seconds, now);
  const numericTarget = Number(targetAqi);
  const goalValue = targetAqi === "" ? null : Number.isFinite(numericTarget) ? Math.max(0, Math.min(500, numericTarget)) : 50;
  const goalGap = currentAqi == null || goalValue == null ? null : Math.max(0, currentAqi - goalValue);
  const planIsCurrent = Boolean(plan
    && plan.areaLabel === locationLabel
    && plan.locationId === currentLocationId
    && plan.targetAqi === goalValue
    && plan.currentAqi === currentAqi
    && plan.signalId === insight.id);
  const currentPlace = {
    id: currentLocationId,
    label: locationLabel,
    region: deviceLocation?.region ?? "Pune, Maharashtra",
    latitude: location.latitude,
    longitude: location.longitude,
  };
  const isCurrentLocationSaved = savedLocations.some((place) => sameSavedPlace(place, currentPlace));
  const selectedLocationValue = deviceLocation?.source === "saved" ? `saved:${deviceLocation.id}` : deviceLocation ? "device" : areaName;

  // Saved places: load once, then persist on change.
  useEffect(() => {
    try {
      setSavedLocations(parseSavedLocations(localStorage.getItem(SAVED_PLACES_KEY)));
    } catch (error) {
      setSavedLocationError(error.message);
    } finally {
      setSavedLocationsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!savedLocationsReady) return;
    try {
      localStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(savedLocations));
      setSavedLocationError("");
    } catch {
      setSavedLocationError("Saved places could not be stored in this browser.");
    }
  }, [savedLocations, savedLocationsReady]);

  // Air quality + weather for the selected place. Citywide also loads all area readings.
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
        if (controller.signal.aborted) return;
        setAreaReadings(readings);
        areaReadingsRefreshKey.current = refreshKey;
        setAreasError("");
        setAreasLoading(false);
        readings.forEach((reading, index) => {
          airCache.current.set(locationKey(PUNE_AREAS[index]), { air: reading });
        });
        const aggregated = aggregateAreaReadings(readings);
        airCache.current.set(cacheKey, { air: aggregated });
        setAir(aggregated);
      })
      : fetchAirQuality(location, controller.signal).then((reading) => {
        if (controller.signal.aborted) return;
        airCache.current.set(cacheKey, { air: reading });
        setAir(reading);
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
    const refreshTimer = window.setInterval(refresh, AUTO_REFRESH_MS);
    return () => {
      controller.abort();
      window.clearInterval(refreshTimer);
    };
  // `location` is derived from the id below; listing the object would refetch every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocationId, refreshKey, isCitywide, refresh]);

  // Area readings for the map and comparison when a single place is selected.
  useEffect(() => {
    if (!["Overview", "Neighborhoods"].includes(section) || isCitywide) return undefined;
    if (areaReadings.length === PUNE_AREAS.length && areaReadingsRefreshKey.current === refreshKey) return undefined;
    const controller = new AbortController();
    setAreasLoading(true);
    setAreasError("");
    fetchAreaAirQuality(PUNE_AREAS, controller.signal)
      .then((readings) => {
        if (controller.signal.aborted) return;
        areaReadingsRefreshKey.current = refreshKey;
        setAreaReadings(readings);
        readings.forEach((reading, index) => {
          airCache.current.set(locationKey(PUNE_AREAS[index]), { air: reading });
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

  // A comparison is a snapshot of specific readings; drop it when those readings change.
  useEffect(() => setComparisonReport(null), [areaReadings]);

  function navigate(id) {
    setSection(id);
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  }

  function chooseArea(name) {
    locationRequestId.current += 1;
    setIsLocating(false);
    setDeviceLocation(null);
    setAreaName(name);
    setLocationError("");
    setLocationMessage("");
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

  function toggleSaved() {
    setSavedLocations((places) => (places.some((item) => sameSavedPlace(item, currentPlace))
      ? places.filter((item) => !sameSavedPlace(item, currentPlace))
      : [...places, currentPlace]));
  }

  function locateDevice() {
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
            setDeviceLocation({ ...coordinates, label: "Nearby area", region: "", source: "device" });
            setLocationMessage("Place name unavailable. Showing an estimate for your location.");
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

  function changeTarget(value) {
    if (value === "" || (Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 500)) setTargetAqi(value);
  }

  function generatePlan() {
    if (currentAqi == null || goalValue == null) return;
    const areaPlan = generateAreaActionSuggestions(deviceLocation ? locationLabel : areaName, insight.id);
    setPlan({
      areaLabel: locationLabel,
      locationId: currentLocationId,
      targetAqi: goalValue,
      currentAqi,
      signalId: insight.id,
      signalLabel: insight.label,
      context: areaPlan.context,
      items: areaPlan.items,
    });
    setPlanShareMessage("");
  }

  function downloadPlan() {
    const file = new Blob([buildPlanText(plan)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = planFileName(locationLabel);
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setPlanShareMessage("Plan downloaded. You can print it or attach it to a message.");
  }

  async function sharePlan() {
    const text = buildPlanText(plan);
    try {
      if (navigator.share) {
        await navigator.share({ title: `Airwise action plan — ${locationLabel}`, text });
        setPlanShareMessage("Your plan is ready to share.");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setPlanShareMessage("Plan copied. Paste it into a message to share.");
      } else {
        setPlanShareMessage("Sharing isn’t available in this browser. Download the plan instead.");
      }
    } catch (error) {
      if (error.name !== "AbortError") setPlanShareMessage("Could not share the plan. Try downloading it instead.");
    }
  }

  const sectionInfo = SECTIONS.find((item) => item.id === section);
  const title = section === "Overview" ? (isCitywide ? "Pune air quality" : `Air near ${locationLabel}`) : sectionInfo.fullLabel ?? sectionInfo.label;
  const displayDate = new Intl.DateTimeFormat("en-IN", { weekday: "long", month: "long", day: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(now));
  const needsAir = section === "Overview" || section === "Forecast";
  const activeArea = deviceLocation || isCitywide ? null : areaName;
  const locationDetail = [deviceLocation?.street, deviceLocation?.region || "Pune, Maharashtra", deviceLocation?.accuracy ? `±${Math.round(deviceLocation.accuracy)} m` : ""].filter(Boolean).join(" · ");

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      <Sidebar section={section} onNavigate={navigate} locationLabel={locationLabel} locationDetail={locationDetail} />
      <div className="app-main">
        <TopBar
          title={sectionInfo.fullLabel ?? sectionInfo.label}
          status={airError ? { ok: false, label: "Data unavailable" } : { ok: true, label: "Model estimate" }}
          isLoading={isLoading}
          onRefresh={refresh}
          theme={theme}
          onToggleTheme={toggleTheme}
          aqi={air?.current?.us_aqi}
          threshold={threshold}
          onThresholdChange={setThreshold}
        />
        <main id="main" className="page">
          <header className="page-header">
            <div>
              <p className="eyebrow">{displayDate} · {deviceLocation ? "Your area" : "Pune"}</p>
              <h1>{title}</h1>
              <p className="page-intro">{INTROS[section](locationLabel, isCitywide)}</p>
            </div>
            <LocationBar
              deviceLocation={deviceLocation}
              savedLocations={savedLocations}
              selectedValue={selectedLocationValue}
              onChoose={chooseLocation}
              onLocate={locateDevice}
              isLocating={isLocating}
              isSaved={isCurrentLocationSaved}
              onToggleSave={toggleSaved}
            />
          </header>

          {(locationMessage || locationError) && (
            <div className={`notice ${locationError ? "notice-error" : "notice-info"}`} role={locationError ? "alert" : "status"}>{locationError || locationMessage}</div>
          )}
          {savedLocationError && <div className="notice notice-error" role="alert">{savedLocationError}</div>}

          {needsAir && isLoading && (
            <>
              <LoadingNotice>Loading air-quality and weather data for {locationLabel}…</LoadingNotice>
              <Skeleton height={260} />
            </>
          )}
          {needsAir && airError && !air && (
            <ErrorNotice title="Air-quality data could not be loaded" message={airError} onRetry={refresh} />
          )}
          {needsAir && airError && air && (
            <ErrorNotice title="Showing the last loaded reading" message={airError} onRetry={refresh} />
          )}

          {section === "Overview" && !isLoading && air && (
            <OverviewView
              air={air}
              locationLabel={locationLabel}
              freshness={freshness}
              outlook={outlook}
              insight={insight}
              isCitywide={isCitywide}
              areaReadings={areaReadings}
              areasLoading={areasLoading}
              activeArea={activeArea}
              onSelectArea={chooseArea}
              onNavigate={navigate}
            />
          )}
          {section === "Forecast" && !isLoading && air && (
            <ForecastView air={air} weather={weather} weatherError={weatherError} locationLabel={locationLabel} outlook={outlook} />
          )}
          {section === "Neighborhoods" && (
            <NeighborhoodsView
              areaReadings={areaReadings}
              areasLoading={areasLoading}
              areasError={areasError}
              citySummary={citySummary}
              isCitywide={isCitywide}
              activeArea={activeArea}
              onSelectArea={chooseArea}
              onSelectCity={() => chooseArea(PUNE_CITY.name)}
              onRetry={refresh}
              comparisonAreas={comparisonAreas}
              onToggleComparison={(name) => {
                setComparisonAreas((current) => (current.includes(name) ? current.filter((area) => area !== name) : [...current, name]));
                setComparisonReport(null);
              }}
              comparisonReady={comparisonReady}
              onCompare={() => setComparisonReport(comparisonReadings.map(({ name, reading }) => ({ name, aqi: Math.round(reading.us_aqi) })))}
              comparisonReport={comparisonReport}
            />
          )}
          {section === "Take action" && (
            <TakeActionView
              air={isLoading ? null : air}
              airError={airError}
              locationLabel={locationLabel}
              currentAqi={isLoading ? null : currentAqi}
              targetAqi={targetAqi}
              onTargetChange={changeTarget}
              goalValue={goalValue}
              goalGap={goalGap}
              onGenerate={generatePlan}
              plan={plan}
              planIsCurrent={planIsCurrent && !isLoading}
              onShare={sharePlan}
              onDownload={downloadPlan}
              shareMessage={planShareMessage}
              recommendations={recommendations}
              search={search}
              onSearch={setSearch}
              onRetry={refresh}
            />
          )}

          <footer className="page-footer">
            <span><span className={`status-dot ${airError ? "offline" : ""}`} aria-hidden="true" />{airError ? "Air-quality update unavailable" : `Model data · ${freshness}`}</span>
            <a href="https://open-meteo.com/en/docs/air-quality-api" target="_blank" rel="noreferrer">How this estimate is made</a>
            <span>For information only — not medical advice.</span>
          </footer>
        </main>
      </div>
      <TabBar section={section} onNavigate={navigate} />
    </div>
  );
}

export default App;
