# Airwise — AQI Insights

[![CI](https://github.com/mrajat31/airwise/actions/workflows/ci.yml/badge.svg)](https://github.com/mrajat31/airwise/actions/workflows/ci.yml)

A responsive air-quality dashboard for Pune. It answers the question most people open it with — *is the air OK right now, and when is it better?* — with a category-coloured AQI, plain-language guidance and the best time to be outside, in light or dark mode on any screen size.

It retrieves current conditions, a 7-day model archive, and forecasts from Open-Meteo's air-quality and weather APIs; offers an opt-in device-location lookup with public reverse geocoding; compares Pune model grids; and includes Overview, Forecast, Neighborhoods, and a combined Take action workspace.

## Run locally

1. Install Node.js 20 or newer.
2. In this folder, run `npm ci`.
3. Run `npm run dev` and open the local URL printed by Vite.
4. Run `npm run build` to create the production site in `dist`.

## Quality checks

| Command | What it does |
| --- | --- |
| `npm run lint` | ESLint (React and hooks rules) |
| `npm test` | Vitest unit and component tests (jsdom + Testing Library) |
| `npm run test:watch` | Tests in watch mode |
| `npm run test:coverage` | Tests with coverage; fails below 80% lines/statements/functions or 70% branches |
| `npm run check` | Lint, coverage and build — the same checks CI runs |

Tests live next to the code (`src/**/*.test.{js,jsx}`). Network calls are stubbed with fixtures in `src/test/fixtures.js`, so tests never call Open-Meteo.

### Continuous integration

- `.github/workflows/ci.yml` runs lint, tests with coverage and the build on Node 20 and 22 for every pull request. The coverage report is uploaded as an artifact.
- `.github/workflows/deploy.yml` reruns the same checks on `main` and publishes to GitHub Pages only if they pass.
- `.github/dependabot.yml` opens grouped weekly npm updates and monthly GitHub Actions updates.

## Project structure

```
src/
  App.jsx            state, data loading and routing between views
  airQuality.js      Open-Meteo / geocoding clients, AQI categories and scale
  areaActionPlan.js  area planning profiles and action templates
  lib/               pure logic: formatting, forecast windows, health guidance, insights, saved places, plan text
  components/        app shell, AQI hero, charts, area map, panels, shared UI
  views/             Overview, Forecast, Neighborhoods, Take action
  hooks/             theme and clock hooks
  styles.css         design tokens (light/dark, AQI scale) and responsive layout
docs/PRODUCT_PLAN.md personas, PMF hypothesis and roadmap
```

## Deploy

The app is a static Vite site and can be deployed to Vercel, Netlify, or any static web host.

### GitHub Pages

1. Push the `main` branch to a GitHub repository. The included Actions workflow builds the site and publishes it to GitHub Pages.
2. In the repository's **Settings → Pages**, set the build and deployment source to **GitHub Actions**.
3. After the workflow succeeds, open the Pages URL shown in the workflow deployment environment (usually `https://OWNER.github.io/REPOSITORY/`).

### Vercel

1. Push this folder to a GitHub repository.
2. In Vercel, import the repository.
3. Keep the detected Vite settings: build command `npm run build`, output directory `dist`.
4. Select **Deploy**. No environment variables are required for the demo.

### Netlify

1. Import the GitHub repository in Netlify.
2. Set build command to `npm run build` and publish directory to `dist`.
3. Select **Deploy site**.

## Data sources and limitations

- Air quality and hourly forecasts: [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api), using CAMS model data.
- Weather: [Open-Meteo Forecast API](https://open-meteo.com/en/docs).
- Device-coordinate reverse geocoding: [Photon](https://photon.komoot.io/) and [Nominatim](https://nominatim.openstreetmap.org/) (OpenStreetMap data). Coordinates are sent to these services only after the user opts into device location.
- The browser calls these public APIs directly; this demo does not need API credentials. Review the provider's [terms and pricing](https://open-meteo.com/en/pricing) before public or commercial use. Some usage requires a paid plan and attribution.
- The displayed AQI is the US AQI. Gas concentrations are shown in the API's native µg/m³ units.
- The Overview trend requests seven past days and five forecast days of hourly CAMS values. Past values are archived atmospheric model estimates, not verified historical station observations. The trend can switch between overall US AQI, PM2.5, PM10, NO₂, and O₃.
- Pollutant-specific US AQI components are used to identify the highest modelled pollutant signal. This is not source apportionment: it cannot establish that traffic, construction, or another source caused the reading.
- The "live" label means the dashboard is connected to a current model feed, not that values update continuously. The model observation timestamp and age are shown; model update frequency depends on the provider.
- These values are atmospheric model estimates, not readings from municipal reference monitors or street-level IoT sensors. Model grid resolution is regional; nearby Pune areas can share a grid cell. API update intervals also vary by model.
- Device location is requested only after the user selects **Use my location**. High accuracy is requested from the device, with no cached coordinates; actual accuracy depends on device hardware, browser permissions, and whether GPS is available. The browser requires a secure context (HTTPS, or localhost for development). Coordinates are sent to Open-Meteo for model estimates and Photon (or its fallback) for a nearby place name.
- Location names are reverse-geocoded to a nearby mapped locality and city where available, with a nearby street as secondary detail. Map data © OpenStreetMap contributors. Public geocoding services have usage policies and availability limits; location features are user-initiated.
- Users can save and remove named places in the location selector. Saved places are stored in that browser's local storage and are not synced across devices.
- Neighborhood coordinates are approximate area-center coordinates used to query the model. The interactive area cards are not a live sensor map.
- The Overview hotspot plot places model estimates at the 12 configured Pune area-centre coordinates. It is not a continuous spatial interpolation, administrative boundary map, or live sensor map; multiple points can share the same model grid.
- Neighborhoods lets users select multiple areas and generate a comparison on demand. A lower value only describes this model snapshot; area points may share a grid cell and should not be treated as ground-truth neighborhood rankings.
- Forecast insights identify the lowest mean 3-hour window and highest hourly US AQI point in the next 24 hours. These are rule-based summaries of model forecasts, not external AI-generated predictions, alerts, or guarantees.
- Pune city AQI is the unweighted mean of unique CAMS model grid points returned for the 12 configured area coordinates. It is not a population-weighted or official city AQI; overlapping area coordinates can resolve to the same model grid.
- The combined Take action workspace separates an area AQI target and evidence-informed environmental action plan from the personal health guidance below it. Selecting **Get suggestions** creates a rule-based plan tailored to the selected Pune area's planning context and modelled pollutant clue, with the area's actions displayed first, followed by pollutant-specific checks and progress measures. Known areas have distinct planning profiles; an unrecognized device location gets a cautious local-audit plan. These profiles are starting hypotheses, not live inventories of building density, tree cover, traffic, or emission sources, and should be checked with local evidence and community priorities. It is not generative-AI output: no AI service is connected. The plan can be shared, downloaded as text, or printed/saved to PDF. A goal is not a forecast; the app does not calculate AQI reductions, tree counts, or vehicle reductions without local source/emissions data and a validated intervention model.
- Area action suggestions draw on guidance from the [WHO](https://www.who.int/news-room/fact-sheets/detail/ambient-(outdoor)-air-quality-and-health), India's [CPCB National Clean Air Programme portal](https://prana.cpcb.gov.in/), the [European Environment Agency](https://www.eea.europa.eu/en/topics/in-depth/air-pollution/transport-and-mobility), and a [study evaluating China's targeted clean-air policy](https://pubmed.ncbi.nlm.nih.gov/35738375/). The study reports results for a bundled policy in its study regions; it is not a prediction for Pune or any single intervention.
- The Overview describes pollutant-specific model signals as leads to investigate, not confirmed causes or source attribution. It does not claim that a number of trees or vehicle-trip reductions will produce a specific AQI change. Such impact estimates need local source-apportionment, emissions, land-cover, meteorology, and dispersion data plus validation. AQI 50 is a US AQI category boundary, not an India-specific regulatory target.
- Personal protection guidance follows the US AQI categories described by [AirNow](https://www.airnow.gov/aqi/aqi-basics/). It is general information, not medical advice. Outdoor model estimates do not measure indoor air or diagnose a need for an air purifier.
- Do not use these estimates alone for health, emergency, or policy decisions. For operational use, compare with official CPCB/MPCB station measurements and follow local authority guidance.

The app surfaces loading and provider errors rather than substituting demo readings. Planned actions and alert reminder thresholds remain in the current browser session; there is no account, notification service, or database yet.

## Suggested next steps

See [docs/PRODUCT_PLAN.md](docs/PRODUCT_PLAN.md) for the full plan. Highlights:


- Integrate official CPCB/MPCB monitoring station data and show station identity, distance, and measurement time alongside model estimates.
- Add persistent accounts, saved neighborhood preferences, and real alert delivery.
- Calibrate and validate any intervention simulator against local observations before presenting impact estimates.
- Review API-provider terms and attribution requirements before commercial deployment.
