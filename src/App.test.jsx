import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App.jsx";
import { PUNE_AREAS } from "./airQuality.js";
import { airReading, mockOpenMeteo } from "./test/fixtures.js";

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

async function renderApp(options = {}) {
  const network = mockOpenMeteo({ airFor: defaultAir, ...options });
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: /Current air quality/ });
  return { user, ...network };
}

describe("Overview", () => {
  it("shows the Pune-wide average with its category and next-24-hour summary", async () => {
    await renderApp();
    // 11 areas at 120 and Baner at 60, all on distinct grid points -> 115.
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
    expect(screen.getByText("Best time for outdoor activity")).toBeInTheDocument();
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

  it("opens the alert threshold and closes it with Escape", async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole("button", { name: "Air quality alert settings" }));
    const dialog = screen.getByRole("dialog", { name: "Alert threshold" });
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
