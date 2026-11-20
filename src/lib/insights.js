export const POLLUTANTS = [
  { id: "pm2_5", short: "PM2.5", label: "PM2.5 fine particles", aqiKey: "us_aqi_pm2_5", unit: "µg/m³" },
  { id: "pm10", short: "PM10", label: "PM10 coarse particles", aqiKey: "us_aqi_pm10", unit: "µg/m³" },
  { id: "nitrogen_dioxide", short: "NO₂", label: "NO₂ nitrogen dioxide", aqiKey: "us_aqi_nitrogen_dioxide", unit: "µg/m³" },
  { id: "ozone", short: "O₃", label: "O₃ ozone", aqiKey: "us_aqi_ozone", unit: "µg/m³" },
];

const INSIGHTS = {
  pm2_5: {
    summary: "Very small particles are the strongest signal in this reading. They can come from several sources, so this is a clue—not a diagnosis.",
    actions: [
      "Ask local teams to check busy roads, diesel exhaust, generators, and open burning nearby.",
      "If a source is confirmed, focus on that source and check the air again to see if conditions change.",
    ],
    protection: "When air quality is poor, spend less time doing strenuous activity outdoors. A suitable HEPA filter can help with particles indoors.",
  },
  pm10: {
    summary: "Larger dust particles are the strongest signal in this reading. Road or construction dust could be checked, but the model cannot confirm the source.",
    actions: [
      "Ask local teams to check construction sites, uncovered loads, and dusty roads nearby.",
      "If dust is found, request safer material covering and dust control, then check whether readings improve.",
    ],
    protection: "When air quality is poor, avoid strenuous activity in dusty places. Planting trees is a long-term benefit, not a quick fix for dust.",
  },
  nitrogen_dioxide: {
    summary: "A gas linked to burning fuel is the strongest signal. Traffic may be one source, but this reading cannot confirm that.",
    actions: [
      "Ask local teams to check traffic queues, idling vehicles, and bus or delivery stops nearby.",
      "If traffic is confirmed, consider reducing idling and improving public transport, then measure the air again.",
    ],
    protection: "Check the forecast before strenuous outdoor activity. An air cleaner indoors does not change the air outside.",
  },
  ozone: {
    summary: "Ozone is the strongest signal. It forms in the air on sunny days, so one area's vehicle or tree count cannot predict its level.",
    actions: [
      "Check how ozone changes through the day and compare it with official readings.",
      "Ozone can travel across areas, so work with city teams on wider solutions and measure the results.",
    ],
    protection: "Use the hourly forecast to avoid strenuous activity when ozone is higher. A standard HEPA filter does not remove ozone outdoors.",
  },
};

/** The pollutant with the highest component US AQI, with plain-language follow-up. */
export function getOverviewInsight(reading) {
  const current = reading?.current;
  const lead = POLLUTANTS
    .map((pollutant) => ({ ...pollutant, componentAqi: current?.[pollutant.aqiKey], value: current?.[pollutant.id] }))
    .filter((pollutant) => Number.isFinite(pollutant.componentAqi))
    .sort((first, second) => second.componentAqi - first.componentAqi)[0];
  if (!lead) {
    return {
      id: null,
      label: "No pollutant detail yet",
      componentAqi: null,
      concentration: null,
      summary: "We don't have enough detail to tell which type of pollution is highest right now.",
      actions: ["Refresh the reading and check a nearby official air-quality monitor."],
      protection: "Use the overall AQI and follow local health advice.",
    };
  }
  return {
    id: lead.id,
    label: lead.label,
    componentAqi: Math.round(lead.componentAqi),
    concentration: lead.value,
    ...INSIGHTS[lead.id],
  };
}

/** Screening ideas for local teams, triggered by modelled concentrations. */
export function makeRecommendations(reading) {
  const current = reading?.current;
  if (!current) return [];
  const ideas = [];
  if (current.pm10 >= 45 || current.pm2_5 >= 25) {
    ideas.push({
      id: "dust-check",
      type: "Dust & construction",
      title: "Check dust controls around active worksites",
      detail: "Review site covering, wheel washing, and road-cleaning schedules near busy routes.",
      basis: `modelled PM10 ${Number(current.pm10).toFixed(0)} and PM2.5 ${Number(current.pm2_5).toFixed(0)} µg/m³`,
      icon: "wind",
      tone: "sensitive",
    });
  }
  if (current.nitrogen_dioxide >= 20) {
    ideas.push({
      id: "traffic-check",
      type: "Traffic & mobility",
      title: "Review peak-hour traffic pinch points",
      detail: "Check idling and heavy-vehicle patterns with local transport and traffic teams.",
      basis: `modelled nitrogen dioxide ${Number(current.nitrogen_dioxide).toFixed(1)} µg/m³`,
      icon: "route",
      tone: "moderate",
    });
  }
  if (ideas.length === 0) {
    ideas.push({
      id: "monitoring-check",
      type: "Routine monitoring",
      title: "Keep monitoring local conditions",
      detail: "Use the next-day outlook to plan outdoor activity and review any new local observations.",
      basis: "current modelled AQI and particulate levels are below the dashboard's screening triggers",
      icon: "activity",
      tone: "good",
    });
  }
  return ideas;
}
