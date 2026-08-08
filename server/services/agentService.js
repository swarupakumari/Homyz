import { planQuery, toSearchFilters } from "./plannerService.js";
import { searchResidencies } from "./searchService.js";
import { scoreProperties } from "./recommendationService.js";
import { compareTopProperties } from "./comparisonService.js";
import { generateReport } from "./reportService.js";

// Orchestrates the full agentic pipeline:
//
//   User -> Planner (LLM call 1) -> Search Service -> Recommendation Engine
//        -> Comparison Service -> Report Generator (LLM call 2) -> Response
//
// This file contains no query-building, no scoring, and no LLM calls of its
// own — it only calls the existing/new services in order and assembles
// their already-decided outputs into the API response shape. Search and
// Recommendation are the *exact* services Sprint 2/3 already built; nothing
// here re-implements or duplicates them.
export const getPropertyAdvice = async (prompt, previousPlan = null) => {
  // Step 1: Planner. Understands intent; decides if we even have enough
  // to proceed. This is the ONLY step allowed to ask the user anything.
  const plan = await planQuery(prompt, previousPlan);

  if (plan.missingCriticalInfo) {
    return {
      success: true,
      needsClarification: true,
      clarifyingQuestion: plan.clarifyingQuestion,
      queryAnalysis: toQueryAnalysis(plan),
    };
  }

  // Step 2: Search Tool — reuses the existing Search Service unmodified.
  // Never touches MongoDB directly from here.
  let searchFilters = toSearchFilters(plan);
  let { data } = await searchResidencies(searchFilters);

  // Deterministic adaptive retry (still zero LLM calls): a single-term
  // `keyword` occasionally doesn't literally appear in any listing's text
  // (e.g. "schools" — the same substring-match limitation the Search
  // Service has always had), which would otherwise produce a confident
  // false "no matches" even when the city/budget/bedrooms alone have real
  // inventory. If the keyword-qualified search comes back empty, broaden
  // once by dropping just the keyword and re-searching on the structural
  // filters. This is adaptive tool use, not a ranking decision — the
  // Recommendation Engine still does all the scoring below either way.
  if (data.length === 0 && searchFilters.keyword) {
    const { keyword, ...withoutKeyword } = searchFilters;
    const broadened = await searchResidencies(withoutKeyword);
    if (broadened.data.length > 0) {
      data = broadened.data;
      searchFilters = withoutKeyword;
    }
  }

  // Reuses the Search Service again (still no direct MongoDB access) with
  // no filters at all, purely to report how large the searchable inventory
  // is — distinct from how many of those matched this specific query.
  const { total: propertiesSearched } = await searchResidencies({});

  // Step 3: Recommendation Tool — reuses the existing Recommendation
  // Engine's deterministic scoring (scoreProperties), never its LLM
  // explanation step, so this stage costs zero additional LLM calls.
  const ranked = scoreProperties(searchFilters, data);

  // Step 4: Comparison Tool — new, but entirely deterministic (no LLM).
  const comparison = compareTopProperties(ranked);

  const summary = {
    propertiesSearched,
    matchingProperties: data.length,
    searchFilters,
  };

  // Step 5: Report Generator — the agent's second and final LLM call (or
  // zero calls if there were no matches to report on). Only rephrases the
  // facts already decided above; never invents or reorders anything.
  const narrative = await generateReport(plan, summary, comparison);

  return assembleResponse({ plan, summary, comparison, narrative });
};

const toQueryAnalysis = (plan) => ({
  city: plan.city,
  country: plan.country,
  budget: { min: plan.minPrice, max: plan.maxPrice },
  bedrooms: plan.bedrooms,
  bathrooms: plan.bathrooms,
  familySize: plan.familySize,
  lifestyle: plan.lifestyle,
  amenities: plan.amenities,
  specialRequirements: plan.specialRequirements,
  keyword: plan.keyword,
});

const toResponseEntry = (entry, label, why) =>
  entry && {
    label,
    score: entry.score,
    reasons: entry.reasons,
    why: why || null,
    property: entry.property,
  };

const assembleResponse = ({ plan, summary, comparison, narrative }) => ({
  success: true,
  needsClarification: false,
  queryAnalysis: toQueryAnalysis(plan),
  summary: {
    propertiesSearched: summary.propertiesSearched,
    matchingProperties: summary.matchingProperties,
    searchFilters: summary.searchFilters,
    executiveSummary: narrative.executiveSummary,
  },
  bestProperty: toResponseEntry(comparison.overallBest, "Overall Best", narrative.overallBestWhy),
  bestValue: toResponseEntry(comparison.bestValue, "Best Value", narrative.bestValueWhy),
  luxuryChoice: toResponseEntry(comparison.luxuryChoice, "Luxury Choice", narrative.luxuryChoiceWhy),
  recommendations: comparison.top5.map((entry) => ({
    score: entry.score,
    reasons: entry.reasons,
    property: entry.property,
  })),
  comparison: {
    mostAffordable: toResponseEntry(comparison.mostAffordable, "Most Affordable", narrative.mostAffordableWhy),
    bestFamilyHome: toResponseEntry(comparison.bestFamilyHome, "Best Family Home", narrative.bestFamilyHomeWhy),
  },
  finalAdvice: {
    text: narrative.finalAdvice,
    topPickPropertyId: comparison.overallBest ? comparison.overallBest.property.id : null,
  },
});
