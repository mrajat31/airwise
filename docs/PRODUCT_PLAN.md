# Airwise product plan: path to product–market fit

This plan covers who Airwise is for, what it should do first, how we will know it is working, and what to build in which order. It starts with UI/UX, because that is where the current product loses people fastest.

## 1. Where the product is today

Airwise has trustworthy data plumbing (CAMS model estimates via Open-Meteo, careful caveats, area comparison and an action-plan generator). The experience did not yet match that quality:

| Problem | Effect on users |
| --- | --- |
| Most text was 7–10px, light grey on white | Hard to read on phones and fails WCAG contrast guidance. Older users and anyone outdoors in sunlight struggle. |
| The hero card was green whatever the reading | A "Sensitive groups" reading looked safe. The colour contradicted the number. |
| "When can I go out?" lived on a separate Forecast tab | The most common question needed two taps and some interpretation. |
| Navigation on phones was a hidden drawer | The four core tabs were not discoverable on the device most people use. |
| Two audiences shared one flow | Residents and ward/civic teams got the same screens, and the Overview spent much of its space on source-investigation text. |
| No tests, no lint, deploy on every push | Regressions (such as stale data shown under the wrong location) could ship unnoticed. |

## 2. Who we are building for

**Primary: Pune residents who plan around air quality.** Examples are parents deciding on school runs and park time, runners and cyclists, people with asthma or COPD and their carers, and older adults.

> *"When I'm about to go outside, I want to know quickly whether the air is OK for me and, if not, when it will be better — so I can plan without worrying."*

**Secondary: civic and community actors.** Examples are ward offices, resident welfare associations and school administrators who want an evidence-informed starting point for local action.

> *"When residents raise air-quality concerns, I want a credible, shareable starting plan that I can verify locally."*

The primary persona drives the core experience. The secondary persona is served by **Take action**, and has to earn its place by showing usage.

## 3. PMF hypothesis

> Pune residents who check air quality at least weekly will make Airwise their default because it answers "is it OK, and when is it better?" faster and more clearly than generic weather or AQI apps, with honest local context.

What would prove or disprove it:

| Signal | Target to call it PMF | How to measure |
| --- | --- | --- |
| "How would you feel if you could no longer use Airwise?" → *very disappointed* | ≥ 40% of active users (Sean Ellis test) | In-app survey after a third visit |
| Week-4 retention of new users | ≥ 25% return in week 4 | Privacy-friendly analytics (e.g. Plausible) |
| Time to answer | Median < 10 s from open to seeing "best time outdoors" | Session timing on the Overview |
| Organic sharing | ≥ 10% of plans/screens shared | Count of share and download clicks |

## 4. Principles

1. **Answer first, explain second.** Lead with the number, its meaning and the best time to go out. Detail comes after.
2. **Colour carries meaning.** AQI category colours are used consistently everywhere and are never decorative.
3. **Honest by design.** Keep the model-estimate caveats, but in a calm, readable form rather than as walls of 8px text.
4. **Mobile first.** Thumb-reachable navigation, ≥ 44px touch targets, readable at arm's length.
5. **Accessible by default.** WCAG 2.2 AA contrast, keyboard and screen-reader support, reduced motion respected, dark mode.

## 5. Roadmap

### Phase 1 — Foundation and UI/UX (this change) ✅

- **Design system:** colour, type, spacing, radius and shadow tokens. An AQI category scale with soft/ink variants. Light and dark themes.
- **Readable type:** base 15px, minimum 12–13px for captions (was 7px).
- **Overview hero rebuilt around the resident's question:** the big category-coloured AQI, a plain-language headline ("Sensitive groups should take it easy"), a position on the AQI scale, and at-a-glance cards for *best time outdoors*, *expected peak* and *main pollutant*.
- **Responsive layout:** sidebar on desktop, icon rail on tablet, bottom tab bar on phones. No horizontal scrolling at 320px+.
- **Accessibility:** skip link, `aria-current` and `aria-pressed` states, visible focus rings, screen-reader text for charts and the map, the alert popover closes on Escape or an outside click, reduced-motion support.
- **Previously hidden data now shown:** the pollutant breakdown, hour-by-hour colour-coded forecast bars, and wind direction as a compass point.
- **Bug fixes:** the 24-hour trend axis now shows hours, comparisons are cleared when readings refresh, "Updated X min ago" ticks, one corrupt saved place no longer wipes the list, and the bell only shows a dot when your threshold is reached.
- **Engineering:** `App.jsx` (1,260 lines) split into `lib/` (pure, tested logic), `components/` and `views/`. ESLint. 84 Vitest + Testing Library tests at ~89% line coverage. CI on every pull request (Node 20 and 22). Deploys are gated on CI. Dependabot.

### Phase 2 — Validate the core loop (next 4–6 weeks)

Built:

- ✅ **Measurement.** This consists of:
  - privacy-friendly, Plausible-compatible events: page views, preset choice, card shares, plan downloads and shares, alerts turned on, and a bucketed "time to answer"
  - the in-app PMF survey, asked from the third visit and snoozed for 30 days if dismissed

  Both are off until `PLAUSIBLE_DOMAIN` is set, and they send no locations, place names or identifiers.
- ✅ **Shareable "today" card.** A 1080×1080 PNG for WhatsApp, built on the device. It falls back to a text summary.
- ✅ **Activity presets.** *Running*, *Kids outdoors*, *Commute* and *Everyone*, each with realistic time slots and AQI limits. The choice is remembered.
- ✅ **Honest area comparisons.**
  - Areas with identical model estimates are labelled, and comparisons say when two areas cannot differ.
  - The Pune average now counts all 12 areas. Grouping by the provider's coarse coordinates had left it averaging only 4.

Next:

- **PWA:** install to the home screen, offline last reading, fast repeat loads. This is also the foundation for background alerts.
- Usability sessions with 5–8 residents (parents, runners, people with asthma) on the new Overview, the presets and the share card.
- Native-speaker review of the Marathi and Hindi copy.

### Phase 3 — Retention (6–12 weeks)

Built:

- ✅ **Official station data.** The nearest CPCB/MPCB monitors (via OpenAQ) appear next to the model estimate, with distance, update time and a staleness flag, and as markers on the map. They are fetched at deploy time with a server-side key and refreshed every two hours.
- ✅ **Alerts, first step.** An in-app banner and opt-in browser notifications fire when the reading crosses your level, in either direction, while Airwise is open.
- ✅ **Marathi and Hindi** for the core experience. Action-plan content is still English-only, and the app says so.

Next:

- **Background alerts:** web push through the PWA plus a small push service, covering saved places as well as the current one.
- Saved places and alert settings synced across devices (optional account).
- Translate the Take action content once the copy is stable.

### Quality gates (built)

- ✅ Playwright end-to-end tests on desktop, tablet and phone viewports, with all network mocked.
- ✅ axe WCAG 2.2 A/AA checks on every section in light and dark mode. These caught and fixed two real contrast bugs: the category pill and the goal badge.
- ✅ Lighthouse budgets in CI: accessibility ≥ 95, best practices ≥ 90, SEO ≥ 90, CLS ≤ 0.1. Performance only warns.

### Phase 4 — Civic workflow (only if Phase 2 data supports it)

- Take action as its own space: track plan progress, export to PDF/Docs, collaborate with ward teams.
- Validate with 2–3 resident welfare associations before investing further.

## 6. Risks and how we handle them

| Risk | Mitigation |
| --- | --- |
| Model estimates differ from official monitors and users lose trust | Station readings now sit side by side with the estimate, with a note that some difference is normal. Keep the "model estimate" labels visible. |
| Neighbouring areas get identical model values, so the map looks "all the same" | Say so plainly in the UI (done). Prioritise station data and finer models over more pins. |
| Station data depends on OpenAQ's free tier and CPCB uptime | The panel hides itself when data is missing; stale readings are flagged; the deploy never fails over station data. |
| Health guidance read as medical advice | Keep the AirNow-based wording and the "not medical advice" footer. Have a clinician review the copy before alerts launch. |
| Open-Meteo commercial terms | Review pricing and attribution before any monetised launch. |

## 7. How to work on this repo

```bash
npm ci
npm run dev            # local dev server
npm run lint           # ESLint
npm test               # Vitest, once
npm run test:coverage  # with coverage thresholds (80% lines/statements/functions, 70% branches)
npm run check          # lint + coverage + build, same as CI's first job
npm run test:e2e       # Playwright + axe (run `npx playwright install chromium` once)
```

Every pull request runs `.github/workflows/ci.yml`. Pushes to `main` run the same checks again before `deploy.yml` publishes to GitHub Pages.
