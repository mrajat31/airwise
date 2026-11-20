import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App.jsx";
import { PUNE_AREAS } from "./airQuality.js";
import { airReading, mockOpenMeteo, STATIONS_FILE } from "./test/fixtures.js";

const KOTHRUD = PUNE_AREAS.find((area) => area.name === "Kothrud");
const BANER = PUNE_AREAS.find((area) => area.name === "Baner");
const isAt = (location, area) => location.latitude === area.latitude && location.longitude === area.longitude;

/** City-wide readings at 120 except Baner at 60; Kothrud's own request returns 55. */
function defaultAir(locations) {
  if (locations.length === 1) {
    return airReading({ ...locations[0], aqi: isAt(locations[0], KOTHRUD) ? 55 : 120 });
  }
  return locations.map((location) => airReading({ ...location, aqi: isAt(location, BANER) ? 60 : 120 }));
}

function nav(name) {
  // The sidebar and the mobile tab bar both render; either one works.
  return screen.getAllByRole("button", { name })[0];
}

async function renderApp({ ready = /Current air quality/, ...options } = {}) {
  const network = mockOpenMeteo({ airFor: defaultAir, ...options });
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: ready });
  return { user, ...network };
}

describe("Overview", () => {
  it("shows the Pune-wide average with its category and next-24-hour summary", async () => {
    await renderApp();
    // 11 areas at 120 and Baner at 60, each area counted once -> 115.
    expect(screen.getByRole("heading", { name: /Current air quality: 115 US AQI, Sensitive groups/ })).toBeInTheDocument();
    expect(screen.getByText("Sensitive groups should take it easy")).toBeInTheDocument();
    expect(screen.getByText("Best time outdoors")).toBeInTheDocument();
    expect(screen.getByText(/not an official city reading/)).toBeInTheDocument();
  });

  it("selects an area from the map list and loads its own reading", async () => {
    const { user } = await renderApp();
    const chips = screen.getByLabelText("Choose a Pune area");
    await user.click(within(chips).getByRole("button", { name: /Kothrud/ }));
    expect(await screen.findByRole("heading", { name: /Current air quality: 55 US AQI, Moderate/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Air near Kothrud" })).toBeInTheDocument();
  });

  it("switches the trend chart to hourly labels for the 24-hour range", async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole("button", { name: "24 hours" }));
    expect(screen.getByRole("button", { name: "24 hours" })).toHaveAttribute("aria-pressed", "true");
    const svg = screen.getByRole("img", { name: /US AQI: past model archive and forecast/ });
    const labels = svg.closest(".chart-frame").querySelector(".chart-x-axis").textContent;
    expect(labels).toMatch(/AM|PM/);
    expect(labels).not.toMatch(/Nov/);
  });
});

describe("Navigation", () => {
  it("marks the current section and renders each view", async () => {
    const { user } = await renderApp();
    expect(nav("Overview")).toHaveAttribute("aria-current", "page");

    await user.click(nav("Forecast"));
    expect(nav("Forecast")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Air may be most polluted")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Daily outlook" })).toBeInTheDocument();
    expect(await screen.findByText("23°C")).toBeInTheDocument();

    await user.click(nav("Neighborhoods"));
    expect(screen.getByRole("heading", { name: "Compare areas" })).toBeInTheDocument();

    await user.click(nav("Take action"));
    expect(screen.getByRole("button", { name: /Get suggestions/ })).toBeEnabled();
  });
});

describe("Stale data protection", () => {
  it("never shows the previous location's reading when the new one fails", async () => {
    const home = { id: "home", label: "Home", region: "Pune", latitude: 18.61, longitude: 73.71 };
    localStorage.setItem("airwise.savedLocations", JSON.stringify([home]));
    const { user } = await renderApp({
      airFor: (locations) => (locations.length === 1 && isAt(locations[0], home) ? { status: 503 } : defaultAir(locations)),
    });
    await user.selectOptions(screen.getByLabelText("Choose a place"), "saved:home");

    expect(await screen.findByText("Air-quality data could not be loaded")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Current air quality: 115/ })).not.toBeInTheDocument();

    await user.click(nav("Take action"));
    expect(screen.getByRole("button", { name: /Get suggestions/ })).toBeDisabled();
  });

  it("shows a cached reading for the same place, labelled as the last loaded one, when a refresh fails", async () => {
    let fail = false;
    const { user } = await renderApp({ airFor: (locations) => (fail ? { status: 500 } : defaultAir(locations)) });
    fail = true;
    await user.click(screen.getByRole("button", { name: "Refresh data" }));
    expect(await screen.findByText("Showing the last loaded reading")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Current air quality: 115/ })).toBeInTheDocument();
  });
});

describe("Take action", () => {
  it("builds a plan for the selected area and flags it as stale when the target changes", async () => {
    const { user } = await renderApp();
    await user.click(nav("Take action"));
    await user.click(screen.getByRole("button", { name: /Get suggestions/ }));

    expect(screen.getByRole("heading", { name: "Suggestions for Pune city" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Share plan/ })).toBeEnabled();

    const target = screen.getByRole("spinbutton");
    await user.clear(target);
    await user.type(target, "80");
    expect(screen.getByText("Suggestions need refreshing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Share plan/ })).toBeDisabled();
  });

  it("rejects out-of-range targets", async () => {
    const { user } = await renderApp();
    await user.click(nav("Take action"));
    const target = screen.getByRole("spinbutton");
    await user.clear(target);
    await user.type(target, "999");
    expect(target).toHaveValue(99);
  });

  it("copies the plan when the share sheet is unavailable", async () => {
    const { user } = await renderApp();
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await user.click(nav("Take action"));
    await user.click(screen.getByRole("button", { name: /Get suggestions/ }));
    await user.click(screen.getByRole("button", { name: /Share plan/ }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Airwise area clean-air action plan — Pune city"));
    expect(await screen.findByText(/Plan copied/)).toBeInTheDocument();
  });

  it("filters the ideas list", async () => {
    const { user } = await renderApp();
    await user.click(nav("Take action"));
    await user.type(screen.getByRole("searchbox", { name: "Find an idea" }), "traffic");
    expect(screen.getByRole("heading", { name: "Review peak-hour traffic pinch points" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Check dust controls around active worksites" })).not.toBeInTheDocument();
  });
});

describe("Neighborhoods", () => {
  it("compares selected areas", async () => {
    const { user } = await renderApp();
    await user.click(nav("Neighborhoods"));
    await user.click(screen.getByRole("button", { name: "Compare 2 areas" }));
    expect(screen.getByText(/Baner is lowest \(60\); Kothrud is highest \(120\) — 60 points apart/)).toBeInTheDocument();
  });

  it("requires at least two areas", async () => {
    const { user } = await renderApp();
    await user.click(nav("Neighborhoods"));
    await user.click(screen.getByRole("checkbox", { name: /Baner/ }));
    expect(screen.getByRole("button", { name: "Compare 1 areas" })).toBeDisabled();
    expect(screen.getByText("Choose at least two areas.")).toBeInTheDocument();
  });
});

describe("Saved places", () => {
  it("saves and un-saves the current place in local storage", async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole("button", { name: /Save/ }));
    expect(screen.getByRole("button", { name: /Saved/ })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(JSON.parse(localStorage.getItem("airwise.savedLocations"))).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: /Saved/ }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem("airwise.savedLocations"))).toHaveLength(0));
  });

  it("keeps valid saved places when storage contains a corrupt entry", async () => {
    localStorage.setItem("airwise.savedLocations", JSON.stringify([null, { id: "x", label: "Home", latitude: 18.5, longitude: 73.8 }]));
    await renderApp();
    expect(screen.getByRole("option", { name: "Home" })).toBeInTheDocument();
  });
});

describe("Top bar", () => {
  it("toggles and remembers the theme", async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole("button", { name: "Switch to dark theme" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("airwise.theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
  });

  it("opens the alert settings and closes them with Escape", async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole("button", { name: "Air quality alert settings" }));
    const dialog = screen.getByRole("dialog", { name: "Alerts" });
    expect(within(dialog).getByText(/Now 115 AQI — at or above your level/)).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("refetches when refresh is pressed", async () => {
    const { user, fetchMock } = await renderApp();
    const before = fetchMock.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Refresh data" }));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(before));
  });
});

describe("Activity presets", () => {
  it("re-ranks the best window for the chosen activity and remembers it", async () => {
    // Clean air (40) only from 6 to 8 AM; 120 otherwise. "Now" is 10:00, so tomorrow morning is the clean window.
    const aqiAt = (time) => {
      const hour = Number(time.slice(11, 13));
      return hour >= 6 && hour < 8 ? 40 : 120;
    };
    const { user } = await renderApp({ airFor: (locations) => locations.map((location) => airReading({ ...location, aqiAt })) });
    expect(screen.getByText("Best time outdoors")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Running" }));
    expect(screen.getByRole("button", { name: "Running" })).toHaveAttribute("aria-pressed", "true");
    const stat = screen.getByText("Best time to run").closest(".hero-stat");
    expect(within(stat).getByText("6 AM")).toBeInTheDocument();
    expect(within(stat).getByText("6 AM–7 AM · about 40 AQI")).toBeInTheDocument();
    expect(localStorage.getItem("airwise.activity")).toBe("run");
  });

  it("says so when no window meets the activity's limit", async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole("button", { name: "Kids outdoors" }));
    expect(screen.getByText(/Nothing at or below 50 AQI/)).toBeInTheDocument();
  });
});

describe("Areas the model cannot tell apart", () => {
  const KOTHRUD_OR_WARJE = (location) => isAt(location, KOTHRUD) || isAt(location, PUNE_AREAS.find((area) => area.name === "Warje"));
  // Every area reports the same coarse cell coordinates (as Open-Meteo does), but only
  // Kothrud and Warje return identical values.
  const twins = (locations) => {
    const readings = locations.map((location, index) => airReading({
      latitude: 18.6,
      longitude: 73.8,
      aqi: KOTHRUD_OR_WARJE(location) ? 70 : 100 + index,
    }));
    return locations.length === 1 ? readings[0] : readings;
  };

  it("counts distinct estimates and names areas with identical ones", async () => {
    const { user } = await renderApp({ airFor: twins });
    expect(screen.getByText("12 areas · 11 distinct estimates")).toBeInTheDocument();
    await user.click(nav("Neighborhoods"));
    expect(screen.getByText("Identical estimate to Warje")).toBeInTheDocument();
    expect(screen.getByText("Identical estimate to Kothrud")).toBeInTheDocument();
    expect(screen.queryByText(/Identical estimate to Baner/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Model time/).length).toBe(10);
  });

  it("explains a comparison between areas with identical estimates", async () => {
    const { user } = await renderApp({ airFor: twins });
    await user.click(nav("Neighborhoods"));
    await user.click(screen.getByRole("checkbox", { name: /Baner/ }));
    await user.click(screen.getByRole("checkbox", { name: /Warje/ }));
    await user.click(screen.getByRole("button", { name: "Compare 2 areas" }));
    expect(screen.getByText("Kothrud, Warje have identical model values, so the model cannot tell them apart.")).toBeInTheDocument();
  });
});

describe("Share card", () => {
  it("falls back to copying a text summary when images can't be shared", async () => {
    const { user } = await renderApp();
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await user.click(screen.getByRole("button", { name: "Share today's card" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Pune air quality: 115 US AQI · Sensitive groups"));
    expect(await screen.findByText("Summary copied. Paste it into a message.")).toBeInTheDocument();
  });
});

describe("Alerts", () => {
  function stubNotification(permission = "default") {
    const Notification = vi.fn();
    Notification.permission = permission;
    Notification.requestPermission = vi.fn(async () => {
      Notification.permission = "granted";
      return "granted";
    });
    vi.stubGlobal("Notification", Notification);
    return Notification;
  }

  it("asks for permission, remembers the choice and notifies when the air improves", async () => {
    const Notification = stubNotification();
    let aqi = null;
    const airFor = (locations) => (aqi == null ? defaultAir(locations) : locations.map((location) => airReading({ ...location, aqi })));
    const { user } = await renderApp({ airFor });

    await user.click(screen.getByRole("button", { name: "Air quality alert settings" }));
    await user.click(screen.getByRole("button", { name: "Turn on notifications" }));
    expect(Notification.requestPermission).toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "Turn off notifications" })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("airwise.alerts"))).toEqual({ threshold: 100, notify: true });

    aqi = 40;
    await user.click(screen.getByRole("button", { name: "Refresh data" }));
    expect(await screen.findByText("Air near Pune city is back below your alert level: now 40 AQI.")).toBeInTheDocument();
    expect(Notification).toHaveBeenCalledWith("Air improving: Pune city", expect.objectContaining({ tag: "airwise-pune-city" }));

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/back below your alert level/)).not.toBeInTheDocument();
  });

  it("explains when notifications are blocked", async () => {
    stubNotification("denied");
    const { user } = await renderApp();
    await user.click(screen.getByRole("button", { name: "Air quality alert settings" }));
    expect(screen.getByRole("button", { name: "Turn on notifications" })).toBeDisabled();
    expect(screen.getByText(/Notifications are blocked for this site/)).toBeInTheDocument();
  });
});

describe("Languages", () => {
  it("switches to Marathi and remembers the choice", async () => {
    const { user } = await renderApp();
    await user.selectOptions(screen.getByRole("combobox", { name: "Language" }), "mr");
    expect(screen.getByRole("heading", { level: 1, name: "पुण्यातील हवा गुणवत्ता" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "अंदाज" }).length).toBeGreaterThan(0);
    expect(document.documentElement.lang).toBe("mr");
    expect(localStorage.getItem("airwise.lang")).toBe("mr");
  });

  it("starts in Hindi when that was chosen before", async () => {
    localStorage.setItem("airwise.lang", "hi");
    await renderApp({ ready: /मौजूदा वायु गुणवत्ता/ });
    expect(screen.getByRole("heading", { level: 1, name: "पुणे की वायु गुणवत्ता" })).toBeInTheDocument();
  });

  it("notes that action plans are English-only", async () => {
    localStorage.setItem("airwise.lang", "hi");
    const { user } = await renderApp({ ready: /मौजूदा वायु गुणवत्ता/ });
    await user.click(nav("कदम उठाएँ"));
    expect(screen.getByText("कार्य योजनाएँ और स्थानीय सुझाव अभी केवल अंग्रेज़ी में हैं।")).toBeInTheDocument();
  });
});

describe("Official stations", () => {
  it("shows the nearest monitor beside the model estimate when station data is published", async () => {
    await renderApp({ stations: STATIONS_FILE });
    expect(await screen.findByRole("heading", { name: "Official monitors nearby" })).toBeInTheDocument();
    expect(screen.getByText("Shivajinagar, Pune - IITM")).toBeInTheDocument();
    expect(screen.queryByText("Mumbai - Colaba")).not.toBeInTheDocument();
    expect(screen.getByText(/CPCB · 1\.\d km away/)).toBeInTheDocument();
  });

  it("hides the panel when no station data is published", async () => {
    await renderApp();
    expect(screen.queryByRole("heading", { name: "Official monitors nearby" })).not.toBeInTheDocument();
  });
});

describe("Analytics and PMF survey", () => {
  it("sends no events and shows no survey unless analytics is configured", async () => {
    localStorage.setItem("airwise.visits", "5");
    const { calls } = await renderApp();
    expect(calls.some((url) => url.pathname === "/api/event")).toBe(false);
    expect(screen.queryByText("How would you feel if you could no longer use Airwise?")).not.toBeInTheDocument();
  });

  it("asks the survey from the third visit and records the answer without location data", async () => {
    vi.stubEnv("VITE_PLAUSIBLE_DOMAIN", "airwise.example");
    localStorage.setItem("airwise.visits", "2");
    const { user, fetchMock } = await renderApp();
    expect(screen.getByText("How would you feel if you could no longer use Airwise?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Very disappointed" }));
    expect(screen.getByText(/Thank you/)).toBeInTheDocument();
    const events = fetchMock.mock.calls
      .filter(([url]) => String(url) === "https://plausible.io/api/event")
      .map(([, init]) => JSON.parse(init.body));
    expect(events).toContainEqual(expect.objectContaining({ name: "PMF survey", domain: "airwise.example", props: { lang: "en", answer: "very" } }));
    expect(events.some((event) => event.name === "pageview")).toBe(true);
    expect(JSON.stringify(events)).not.toMatch(/18\.5|73\.8|Kothrud/);
    expect(JSON.parse(localStorage.getItem("airwise.survey")).answer).toBe("very");
  });

  it("respects Do Not Track", async () => {
    vi.stubEnv("VITE_PLAUSIBLE_DOMAIN", "airwise.example");
    Object.defineProperty(navigator, "doNotTrack", { value: "1", configurable: true });
    const { calls } = await renderApp();
    expect(calls.some((url) => url.hostname === "plausible.io")).toBe(false);
    Object.defineProperty(navigator, "doNotTrack", { value: undefined, configurable: true });
  });
});

describe("Areas with one shared estimate", () => {
  it("summarises long lists of identical areas", async () => {
    const { user } = await renderApp({
      airFor: (locations) => (locations.length === 1 ? airReading(locations[0]) : locations.map(() => airReading({ latitude: 18.6, longitude: 73.8 }))),
    });
    expect(screen.getByText("12 areas · 1 distinct estimates")).toBeInTheDocument();
    await user.click(nav("Neighborhoods"));
    const captions = screen.getAllByText("Identical estimate to 11 other areas");
    expect(captions).toHaveLength(12);
    expect(captions[0]).toHaveAttribute("title", expect.stringContaining("Shivajinagar"));
  });
});
