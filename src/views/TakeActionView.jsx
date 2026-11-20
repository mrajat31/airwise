import { ArrowRight, Check, FileDown, Printer, Search, Share2, ShieldCheck, Sparkles, Target } from "lucide-react";
import { AREA_ACTION_SOURCES } from "../areaActionPlan.js";
import { aqiCategory } from "../airQuality.js";
import { healthGuidance } from "../lib/health.js";
import { RecommendationCard } from "../components/panels.jsx";
import { AqiBadge, Card, CardHeader, Caveat, DataAttribution, ErrorNotice } from "../components/ui.jsx";
import { useI18n } from "../i18n/index.jsx";

function ProtectionSection({ aqi, locationLabel }) {
  const health = healthGuidance(aqi);
  const category = aqiCategory(aqi);
  return (
    <section className="protection" aria-labelledby="protect-heading">
      <div className={`protection-banner tone-${category.tone}`}>
        <span className="protection-icon"><ShieldCheck size={22} aria-hidden="true" /></span>
        <div>
          <span className="eyebrow">Protect yourself · {locationLabel}</span>
          <h2 id="protect-heading">{health.label}</h2>
          <p>{health.summary}</p>
        </div>
        <AqiBadge value={aqi} size="lg" />
      </div>
      <div className="grid grid-2">
        <Card>
          <CardHeader title="What you can do today" subtitle="General guidance for this reading" level={3} />
          <ul className="check-list">{health.steps.map((step) => <li key={step}><Check size={16} aria-hidden="true" />{step}</li>)}</ul>
          <a className="link-button" href="https://www.airnow.gov/aqi/aqi-basics/" target="_blank" rel="noreferrer">Official AQI health guidance <ArrowRight size={15} aria-hidden="true" /></a>
        </Card>
        <Card>
          <CardHeader title="Cleaner air indoors" subtitle="Practical ways to reduce exposure at home" level={3} />
          <ul className="check-list">
            <li><Check size={16} aria-hidden="true" />When AQI is high, move strenuous exercise indoors or pick a cleaner hour from the forecast.</li>
            <li><Check size={16} aria-hidden="true" />Keep windows closed when outdoor air is poor, where practical.</li>
            <li><Check size={16} aria-hidden="true" />A correctly sized HEPA air cleaner can reduce particles indoors.</li>
            <li><Check size={16} aria-hidden="true" />Avoid air cleaners that intentionally produce ozone.</li>
          </ul>
          <Caveat>Outdoor estimates do not measure indoor air or determine whether a purifier is needed.</Caveat>
        </Card>
      </div>
    </section>
  );
}

function PlanResult({ plan }) {
  return (
    <div className="plan" aria-live="polite">
      <div className="plan-header">
        <div>
          <h3>Suggestions for {plan.areaLabel}</h3>
          <p>Area-first actions, then the {plan.signalLabel} model clue. Verify sources locally before choosing an intervention.</p>
        </div>
        <span className="pill">{plan.items.length} actions</span>
      </div>
      <div className="plan-context">
        <span className="eyebrow">Planning lens · {plan.context.label}</span>
        <p>{plan.context.context}</p>
        <small>Neighbourhood profiles are starting hypotheses — not measured building, tree-cover, traffic, or emissions inventories.</small>
      </div>
      <ol className="plan-steps">
        {plan.items.map((item, index) => (
          <li key={item.id}>
            <span className="plan-step-number" aria-hidden="true">{index + 1}</span>
            <div>
              <span className="eyebrow">{item.category}</span>
              <h4>{item.title}</h4>
              <p>{item.action}</p>
              <dl>
                <div><dt>Who can lead</dt><dd>{item.owner}</dd></div>
                <div><dt>Track progress</dt><dd>{item.measure}</dd></div>
              </dl>
            </div>
          </li>
        ))}
      </ol>
      <Caveat>
        An evaluation of China’s multi-policy action plan reported 7.25% lower PM2.5 and 10.49% lower coarse-particle concentrations in targeted areas.
        Those are results for a policy package, not expected AQI reductions for Pune or any single action.{" "}
        <a href="https://pubmed.ncbi.nlm.nih.gov/35738375/" target="_blank" rel="noreferrer">Read the study</a>.
      </Caveat>
      <div className="plan-sources">
        <strong>Guidance and examples</strong>
        {AREA_ACTION_SOURCES.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label}<ArrowRight size={13} aria-hidden="true" /></a>)}
      </div>
    </div>
  );
}

export function TakeActionView({
  air, airError, locationLabel, currentAqi, targetAqi, onTargetChange, goalValue, goalGap,
  onGenerate, plan, planIsCurrent, onShare, onDownload, shareMessage,
  recommendations, search, onSearch, onRetry,
}) {
  const { lang, t } = useI18n();
  const visible = recommendations.filter((action) =>
    `${action.title} ${action.detail} ${action.type}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="view">
      {lang !== "en" && <div className="notice notice-info" role="note" lang={lang}>{t("act.englishOnly")}</div>}
      <Card className="goal-card">
        <CardHeader
          eyebrow="Area air-quality goal"
          title={`What could help ${locationLabel} reach its target?`}
          subtitle="Set a target, then get evidence-informed suggestions that local teams can review and measure."
        />
        <div className="goal-row">
          <div className="goal-stat"><span>Current estimate</span><AqiBadge value={currentAqi} size="lg" showLabel /></div>
          <ArrowRight size={20} className="goal-arrow" aria-hidden="true" />
          <label className="goal-stat goal-input">
            <span><Target size={14} aria-hidden="true" /> Target AQI</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max="500"
              step="1"
              value={targetAqi}
              onChange={(event) => onTargetChange(event.target.value)}
            />
          </label>
        </div>
        <p className="goal-gap" role="status">
          {goalValue == null
            ? "Enter a target AQI for this area."
            : currentAqi == null
              ? "Load a current reading to see how far away this goal is."
              : goalGap === 0
                ? "The latest model estimate is at or below this target."
                : `The estimate is ${goalGap} AQI points above this target. This gap is not a prediction of how much any action will reduce AQI.`}
        </p>
        <div className="card-actions">
          <button type="button" className="button button-primary" onClick={onGenerate} disabled={currentAqi == null || goalValue == null}>
            <Sparkles size={16} aria-hidden="true" /> Get suggestions
          </button>
          <span className="muted small">Rule-based templates — not AI-generated and not calculated AQI impacts.</span>
        </div>

        {planIsCurrent
          ? <PlanResult plan={plan} />
          : (
            <div className="plan-placeholder">
              <h3>{plan ? "Suggestions need refreshing" : "Your area action plan will appear here"}</h3>
              <p>{plan
                ? "The reading, target, or pollutant clue has changed. Generate a fresh set before sharing."
                : air ? "Choose a target and select Get suggestions." : "Wait for an air-quality reading, then select Get suggestions."}</p>
            </div>
          )}

        <div className="card-actions plan-export">
          <button type="button" className="button button-primary" onClick={onShare} disabled={!planIsCurrent}><Share2 size={16} aria-hidden="true" /> Share plan</button>
          <button type="button" className="button button-secondary" onClick={onDownload} disabled={!planIsCurrent}><FileDown size={16} aria-hidden="true" /> Download</button>
          <button type="button" className="button button-secondary" onClick={() => window.print()} disabled={!planIsCurrent}><Printer size={16} aria-hidden="true" /> Print / PDF</button>
        </div>
        {shareMessage && <p className="muted small" role="status">{shareMessage}</p>}
        <Caveat>AQI 50 is the US AQI “Good” boundary, not an India-specific standard. Airwise does not estimate tree counts, vehicle reductions, or AQI-point changes.</Caveat>
      </Card>

      {air && <ProtectionSection aqi={air.current?.us_aqi} locationLabel={locationLabel} />}

      <section className="ideas" aria-labelledby="ideas-heading">
        <div className="section-title">
          <div><h2 id="ideas-heading">More ways to help</h2><p>Ideas to discuss with local teams.</p></div>
          <label className="search">
            <Search size={16} aria-hidden="true" />
            <input type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Find an idea" aria-label="Find an idea" />
          </label>
        </div>
        {airError
          ? <ErrorNotice title="Suggestions need current data" message="Load air-quality data before ideas can be shown." onRetry={onRetry} retryLabel="Refresh" />
          : visible.length > 0
            ? <ul className="recommendations">{visible.map((action) => <RecommendationCard key={action.id} action={action} />)}</ul>
            : <p className="empty-state">No ideas match “{search}”. Try a different search.</p>}
      </section>
      <DataAttribution />
    </div>
  );
}
