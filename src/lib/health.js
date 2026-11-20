/** General US AQI category guidance (AirNow). Not medical advice. */
export function healthGuidance(aqi) {
  if (!Number.isFinite(aqi)) {
    return {
      headline: "Waiting for a reading",
      label: "Waiting for a reading",
      summary: "Load an air-quality update to see guidance matched to the current model estimate.",
      steps: ["Check local official air-quality alerts for current conditions."],
    };
  }
  const value = Math.round(aqi);
  if (value <= 50) {
    return {
      headline: "Good day to be outside",
      label: "Good · usual outdoor plans",
      summary: "Air quality is satisfactory; enjoy your usual outdoor activities.",
      steps: ["People unusually sensitive to air pollution can still pay attention to symptoms."],
    };
  }
  if (value <= 100) {
    return {
      headline: "Fine for most people",
      label: "Moderate · sensitive people take care",
      summary: "Most people can continue usual activities. Unusually sensitive people may notice symptoms.",
      steps: ["If you are unusually sensitive, consider reducing prolonged or heavy outdoor exertion if symptoms occur."],
    };
  }
  if (value <= 150) {
    return {
      headline: "Sensitive groups should take it easy",
      label: "Sensitive groups · reduce prolonged exertion",
      summary: "People with asthma or heart and lung conditions, children, and older adults may be more affected.",
      steps: [
        "Sensitive groups should reduce prolonged or heavy outdoor exertion.",
        "Most other people can continue usual activities, while watching for symptoms.",
      ],
    };
  }
  if (value <= 200) {
    return {
      headline: "Limit long outdoor activity",
      label: "Unhealthy · limit longer outdoor exertion",
      summary: "Some people may experience effects; sensitive groups may experience more serious effects.",
      steps: [
        "Sensitive groups should avoid prolonged or heavy outdoor exertion.",
        "Everyone else should consider reducing prolonged outdoor exertion.",
      ],
    };
  }
  if (value <= 300) {
    return {
      headline: "Reduce time outdoors",
      label: "Very unhealthy · reduce outdoor exposure",
      summary: "Health effects may be experienced by everyone, with higher risk for sensitive groups.",
      steps: [
        "Reduce outdoor physical activity; sensitive groups should avoid it.",
        "Move activity indoors to a cleaner-air space when possible.",
      ],
    };
  }
  return {
    headline: "Avoid outdoor exertion",
    label: "Hazardous · avoid outdoor exertion",
    summary: "Health warning: everyone may be affected. Follow official local advisories.",
    steps: [
      "Avoid outdoor physical activity and follow local authority guidance.",
      "Use a cleaner indoor room and reduce outdoor air entering the space where practical.",
    ],
  };
}
