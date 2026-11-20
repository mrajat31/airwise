import { AREA_ACTION_SOURCES } from "../areaActionPlan.js";

/** Plain-text version of a generated area plan, for sharing and download. */
export function buildPlanText(plan, date = new Date()) {
  const gap = Math.max(0, plan.currentAqi - plan.targetAqi);
  const actionLines = plan.items.map((item, index) => [
    `${index + 1}. ${item.title} (${item.category})`,
    `   What to do: ${item.action}`,
    `   Who can lead: ${item.owner}`,
    `   How to track: ${item.measure}`,
  ].join("\n")).join("\n\n");
  return [
    `Airwise area clean-air action plan — ${plan.areaLabel}`,
    new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" }).format(date),
    `Current model estimate: ${plan.currentAqi} US AQI.`,
    `Area target: ${plan.targetAqi} US AQI.`,
    gap === 0
      ? "The latest model estimate is at or below the selected target."
      : `${gap} AQI points separate the current model estimate and target.`,
    "",
    `Area context — ${plan.context.label}:`,
    plan.context.context,
    "This is a planning profile, not a live building, tree-cover, or source inventory. Verify local conditions before acting.",
    "",
    `Main modelled pollutant clue: ${plan.signalLabel}. This clue does not identify the pollution source.`,
    "",
    "Environmental suggestions:",
    actionLines,
    "",
    "Evidence and references:",
    ...AREA_ACTION_SOURCES.map((source) => `- ${source.label}: ${source.url}`),
    "",
    "Important: This is an evidence-informed, rule-based guide—not an AI-generated forecast. The goal gap is a comparison, not a prediction. These actions do not calculate an AQI reduction. The China study evaluated a multi-policy program and its results cannot be transferred as a Pune-area forecast. Verify sources with local evidence and evaluate progress using official monitors; nearby areas may share a broad model estimate.",
    "Data: Open-Meteo CAMS model estimates. https://open-meteo.com/en/docs/air-quality-api",
  ].join("\n");
}

export function planFileName(areaLabel) {
  return `airwise-aqi-goal-${areaLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.txt`;
}
