import { SCORERS } from "../utils/scoring.js";
import { explainRecommendationReasons } from "./aiService.js";

// Only the top-ranked results get a real LLM-generated explanation, so
// latency/cost stay bounded regardless of how many properties the Search
// Service returned. Every result still gets an explanation string — the
// rest fall back to a plain deterministic sentence built from the same
// reasons, with no model call involved.
const MAX_LLM_EXPLANATIONS = 5;

// Runs every deterministic scorer against one property and combines the
// results into a single 0-100 score. Criteria the user didn't ask about
// (or that the property has no data for) are excluded from both the
// numerator and denominator, so the percentage reflects only what was
// actually evaluable for this search — not a fixed 100-point scale that
// most searches could never reach.
const scoreProperty = (filters, property) => {
  const results = SCORERS.map((scorer) => scorer(filters, property));

  const applicableWeight = results.reduce(
    (sum, r) => (r.applicable ? sum + r.weight : sum),
    0
  );
  const earnedWeight = results.reduce(
    (sum, r) => (r.matched ? sum + r.weight : sum),
    0
  );
  const reasons = results.flatMap((r) => r.reasons);

  // Nothing was applicable (e.g. a vague prompt with no extractable
  // filters) — there's nothing to disqualify any result on, so every
  // property ties rather than all scoring 0.
  const score =
    applicableWeight > 0
      ? Math.round((earnedWeight / applicableWeight) * 100)
      : 100;

  return { score, reasons };
};

const fallbackExplanation = (reasons) =>
  reasons.length > 0 ? `Good match: ${reasons.join(", ")}.` : null;

// Pure deterministic scoring + sorting, with NO LLM involvement at all —
// extracted so callers that need ranked results without paying for (or
// counting toward a budget of) explanation LLM calls can use this directly.
// `rankProperties` below is unchanged in behavior; it now just delegates
// its scoring/sorting step to this function instead of inlining it.
export const scoreProperties = (filters, properties) =>
  properties
    .map((property) => {
      const { score, reasons } = scoreProperty(filters, property);
      return { score, reasons, property };
    })
    .sort((a, b) => b.score - a.score);

// Ranks already-filtered Search Service results deterministically (never
// delegating scoring or ordering to the LLM), then optionally asks the
// model to rephrase each property's already-decided reasons into one
// friendly sentence. Input is exactly what Sprint 2's Search Service
// already returned — this never queries the database itself.
export const rankProperties = async (filters, properties) => {
  const scored = scoreProperties(filters, properties);

  try {
    return await Promise.all(
      scored.map(async (entry, index) => {
        if (entry.reasons.length === 0) {
          return { ...entry, explanation: null };
        }
        if (index >= MAX_LLM_EXPLANATIONS) {
          return { ...entry, explanation: fallbackExplanation(entry.reasons) };
        }
        const explanation = await explainRecommendationReasons(entry.reasons);
        return { ...entry, explanation: explanation ?? fallbackExplanation(entry.reasons) };
      })
    );
  } catch {
    // Explanations are optional — if anything unexpected happens here,
    // still return fully-ranked results rather than fail the request.
    return scored.map((entry) => ({
      ...entry,
      explanation: fallbackExplanation(entry.reasons),
    }));
  }
};
