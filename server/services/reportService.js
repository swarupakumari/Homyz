import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getClient, MODEL, mapOpenAIError } from "./aiService.js";
import { REPORT_SYSTEM_PROMPT } from "../utils/agentPrompts.js";

// Structural schema handed to OpenAI — permissive/nullable, no refinements
// (same reasoning as plannerService.js/aiService.js: strict Structured
// Outputs doesn't enforce refinements, so those are checked afterward).
const wireReportSchema = z.object({
  executiveSummary: z.string().nullable(),
  overallBestWhy: z.string().nullable(),
  bestValueWhy: z.string().nullable(),
  luxuryChoiceWhy: z.string().nullable(),
  mostAffordableWhy: z.string().nullable(),
  bestFamilyHomeWhy: z.string().nullable(),
  finalAdvice: z.string().nullable(),
});

const domainReportSchema = z.object({
  executiveSummary: z.string().trim().min(1),
  overallBestWhy: z.string().trim().min(1).nullable(),
  bestValueWhy: z.string().trim().min(1).nullable(),
  luxuryChoiceWhy: z.string().trim().min(1).nullable(),
  mostAffordableWhy: z.string().trim().min(1).nullable(),
  bestFamilyHomeWhy: z.string().trim().min(1).nullable(),
  finalAdvice: z.string().trim().min(1),
});

const summarizePick = (entry) =>
  entry && {
    title: entry.property.title,
    city: entry.property.city,
    price: entry.property.price,
    score: entry.score,
    reasons: entry.reasons,
  };

const reasonsText = (entry) => (entry.reasons.length ? entry.reasons.join(", ") : "a solid overall match for what you asked");

// Zero-cost narrative used whenever there's nothing to report (no matches)
// or the LLM call itself fails — built from the exact same facts the LLM
// would have received, just templated instead of freely written.
const buildFallbackNarrative = (plan, summary, comparison) => {
  if (!comparison.overallBest) {
    return {
      executiveSummary: `We searched ${summary.propertiesSearched} properties${plan.city ? ` in ${plan.city}` : ""} but didn't find any that matched your criteria.`,
      overallBestWhy: null,
      bestValueWhy: null,
      luxuryChoiceWhy: null,
      mostAffordableWhy: null,
      bestFamilyHomeWhy: null,
      finalAdvice: "Try widening your budget or considering a nearby city to see more options.",
    };
  }

  return {
    executiveSummary: `We found ${summary.matchingProperties} matching propert${summary.matchingProperties === 1 ? "y" : "ies"}${plan.city ? ` in ${plan.city}` : ""} within your criteria.`,
    overallBestWhy: `${reasonsText(comparison.overallBest)}.`,
    bestValueWhy: comparison.bestValue ? `${reasonsText(comparison.bestValue)}.` : null,
    luxuryChoiceWhy: comparison.luxuryChoice ? `${reasonsText(comparison.luxuryChoice)}.` : null,
    mostAffordableWhy: comparison.mostAffordable ? `${reasonsText(comparison.mostAffordable)}.` : null,
    bestFamilyHomeWhy: comparison.bestFamilyHome ? `${reasonsText(comparison.bestFamilyHome)}.` : null,
    finalAdvice: `${comparison.overallBest.property.title} is the strongest overall option based on what you're looking for.`,
  };
};

// Report Generator: the second (and last) of the agent's 2-LLM-call
// budget. Receives ONLY already-decided facts — from the Planner, the
// existing Search Service, the existing Recommendation Engine, and the new
// deterministic Comparison Service — and turns them into friendly prose.
// Never retried on failure; falls back to a deterministic templated
// narrative built from the exact same facts instead of spending a second
// call on a retry.
export const generateReport = async (plan, summary, comparison) => {
  if (!comparison.overallBest) {
    // Nothing to write about — skip the LLM call entirely.
    return buildFallbackNarrative(plan, summary, comparison);
  }

  const payload = {
    query: {
      city: plan.city,
      country: plan.country,
      budget: { min: plan.minPrice, max: plan.maxPrice },
      bedrooms: plan.bedrooms,
      familySize: plan.familySize,
      lifestyle: plan.lifestyle,
      amenities: plan.amenities,
      specialRequirements: plan.specialRequirements,
    },
    propertiesSearched: summary.propertiesSearched,
    matchingProperties: summary.matchingProperties,
    overallBest: summarizePick(comparison.overallBest),
    bestValue: summarizePick(comparison.bestValue),
    luxuryChoice: summarizePick(comparison.luxuryChoice),
    mostAffordable: summarizePick(comparison.mostAffordable),
    bestFamilyHome: summarizePick(comparison.bestFamilyHome),
  };

  try {
    const openai = getClient();
    const response = await openai.responses.parse({
      model: MODEL,
      input: [
        { role: "system", content: REPORT_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(payload) },
      ],
      text: { format: zodTextFormat(wireReportSchema, "advisor_report") },
    });

    const parsed = response.output_parsed;
    if (parsed === null) return buildFallbackNarrative(plan, summary, comparison);

    const result = domainReportSchema.safeParse(parsed);
    if (!result.success) return buildFallbackNarrative(plan, summary, comparison);

    return result.data;
  } catch (err) {
    console.error("Report LLM call failed, falling back to templated narrative:", mapOpenAIError(err).message);
    return buildFallbackNarrative(plan, summary, comparison);
  }
};
