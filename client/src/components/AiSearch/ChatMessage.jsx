import React, { useState } from "react";
import { motion } from "framer-motion";
import PropertyCard from "../PropertyCard/PropertyCard";

const FILTER_LABELS = {
  city: "City",
  country: "Country",
  minPrice: "Min $",
  maxPrice: "Max $",
  bedrooms: "Beds",
  bathrooms: "Baths",
  keyword: "Keyword",
};

const formatTimestamp = (timestamp) =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const FilterChips = ({ filters }) => {
  const entries = Object.entries(filters || {}).filter(
    ([, value]) => value !== undefined && value !== null && value !== ""
  );
  if (entries.length === 0) return null;

  return (
    <div className="ai-filter-chips">
      {entries.map(([key, value]) => (
        <span className="ai-filter-chip" key={key}>
          {FILTER_LABELS[key] || key}: {value}
        </span>
      ))}
    </div>
  );
};

// One ranked result: the deterministic match score from the Recommendation
// Engine, the existing (unmodified) PropertyCard, and an expandable "why"
// section showing the reasons/explanation that engine already computed.
const RecommendationCard = ({ recommendation }) => {
  const [expanded, setExpanded] = useState(false);
  const { score, reasons, explanation, property } = recommendation;

  return (
    <div className="ai-recommendation">
      <span className="ai-match-badge">⭐ AI Match {score}%</span>
      <PropertyCard card={property} />
      {reasons.length > 0 && (
        <button
          type="button"
          className="ai-why-toggle"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
        >
          {expanded ? "Hide reasons" : "Why this recommendation?"}
        </button>
      )}
      {expanded && (
        <div className="ai-why-explanation">{explanation || reasons.join(", ")}</div>
      )}
    </div>
  );
};

// One labeled pick from the Agentic AI Property Advisor (Sprint 4) — same
// shape/spirit as RecommendationCard above (score badge + the existing,
// unmodified PropertyCard + expandable reasons), plus the label/emoji and
// the report-writer's one-sentence "why" for this specific pick.
const AdvisorPickCard = ({ emoji, title, pick }) => {
  const [expanded, setExpanded] = useState(false);
  if (!pick) return null;

  return (
    <div className="ai-advisor-pick">
      <div className="ai-advisor-pick-header">
        <span aria-hidden="true">{emoji}</span>
        <span className="ai-advisor-pick-title">{title}</span>
        <span className="ai-match-badge">⭐ AI Match {pick.score}%</span>
      </div>
      <PropertyCard card={pick.property} />
      {pick.why && <p className="ai-advisor-pick-why">{pick.why}</p>}
      {pick.reasons?.length > 0 && (
        <button
          type="button"
          className="ai-why-toggle"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
        >
          {expanded ? "Hide details" : "Why this recommendation?"}
        </button>
      )}
      {expanded && <div className="ai-why-explanation">{pick.reasons.join(", ")}</div>}
    </div>
  );
};

// Full report from the Agentic AI Property Advisor: executive summary,
// Overall Best / Best Value / Luxury Choice, an expandable comparison
// (Most Affordable / Best Family Home), and final advice. Every property
// shown here came from the existing Search Service via the agent's
// orchestration — this component only lays the already-decided facts out.
const AdvisorReport = ({ report }) => {
  const [comparisonExpanded, setComparisonExpanded] = useState(false);
  if (!report) return null;

  const { summary, bestProperty, bestValue, luxuryChoice, comparison, finalAdvice } = report;
  const hasResults = Boolean(bestProperty);
  const hasMoreComparisons = Boolean(comparison?.mostAffordable || comparison?.bestFamilyHome);

  return (
    <div className="ai-advisor-report">
      <div className="ai-advisor-header">
        <span aria-hidden="true">🤖</span> AI Property Advisor Report
      </div>

      <FilterChips filters={summary?.searchFilters} />

      {summary?.executiveSummary && <p className="ai-advisor-summary">{summary.executiveSummary}</p>}

      <div className="ai-advisor-stats">
        <span>
          Properties Searched: <strong>{summary?.propertiesSearched ?? 0}</strong>
        </span>
        <span>
          Matching Properties: <strong>{summary?.matchingProperties ?? 0}</strong>
        </span>
      </div>

      {hasResults ? (
        <>
          <AdvisorPickCard emoji="🏆" title="Overall Best" pick={bestProperty} />
          <AdvisorPickCard emoji="💰" title="Best Value" pick={bestValue} />
          <AdvisorPickCard emoji="✨" title="Luxury Choice" pick={luxuryChoice} />

          {hasMoreComparisons && (
            <div className="ai-advisor-comparison">
              <button
                type="button"
                className="ai-why-toggle"
                onClick={() => setComparisonExpanded((prev) => !prev)}
                aria-expanded={comparisonExpanded}
              >
                {comparisonExpanded ? "Hide more comparisons" : "Show more comparisons"}
              </button>
              {comparisonExpanded && (
                <>
                  <AdvisorPickCard emoji="💸" title="Most Affordable" pick={comparison.mostAffordable} />
                  <AdvisorPickCard emoji="👪" title="Best Family Home" pick={comparison.bestFamilyHome} />
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="ai-no-results">
          No properties matched — try widening the budget or dropping a filter.
        </div>
      )}

      {finalAdvice?.text && (
        <div className="ai-advisor-final-advice">
          <strong>Final Advice:</strong> {finalAdvice.text}
        </div>
      )}
    </div>
  );
};

// Renders a single turn in the conversation. Handles four shapes:
//  - the user's own message
//  - a friendly error
//  - a clarifying question from the Agentic AI Property Advisor (Sprint 4)
//  - a full Advisor Report (Sprint 4), or the original AI Search reply
//    (summary + parsed filters + ranked recommendations) — unchanged from
//    before, still used for anything that isn't a `kind: "advisor-report"`
//    message.
const ChatMessage = ({ message }) => {
  const isUser = message.role === "user";
  const isError = Boolean(message.error);
  const isClarification = message.kind === "clarification";
  const isAdvisorReport = message.kind === "advisor-report";
  // Already sorted server-side by the Recommendation Engine; re-sorting
  // here too is a cheap safety net so the UI never depends on that.
  const recommendations = [...(message.recommendations || [])].sort(
    (a, b) => b.score - a.score
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`ai-chat-message ai-chat-message--${isUser ? "user" : "assistant"} ${
        isError ? "ai-chat-message--error" : ""
      }`}
    >
      {isUser && <div className="ai-chat-bubble">{message.text}</div>}

      {!isUser && isError && <div className="ai-chat-bubble">{message.error}</div>}

      {!isUser && isClarification && (
        <div className="ai-chat-bubble">{message.clarifyingQuestion}</div>
      )}

      {!isUser && isAdvisorReport && <AdvisorReport report={message.report} />}

      {!isUser && !isError && !isClarification && !isAdvisorReport && (
        <>
          <div className="ai-chat-bubble">
            {message.summary}
            <FilterChips filters={message.parsedFilters} />
            {recommendations.length === 0 && (
              <div className="ai-no-results">
                No properties matched — try widening the budget or dropping a filter.
              </div>
            )}
          </div>

          {recommendations.length > 0 && (
            <div className="ai-property-results">
              {recommendations.map((rec) => (
                <RecommendationCard recommendation={rec} key={rec.property.id} />
              ))}
            </div>
          )}
        </>
      )}

      <span className="ai-chat-timestamp">{formatTimestamp(message.timestamp)}</span>
    </motion.div>
  );
};

export default ChatMessage;
