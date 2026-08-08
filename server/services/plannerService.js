import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getClient, MODEL, mapOpenAIError } from "./aiService.js";
import { PLANNER_SYSTEM_PROMPT } from "../utils/agentPrompts.js";

// Structural schema handed to OpenAI — permissive/nullable, no refinements,
// for the same reason as aiService.js's wireFiltersSchema: OpenAI's strict
// Structured Outputs mode doesn't enforce refinements like .int()/.min(),
// so those are applied afterward against whatever the model returned.
const wirePlanSchema = z.object({
  city: z.string().nullable(),
  country: z.string().nullable(),
  minPrice: z.number().nullable(),
  maxPrice: z.number().nullable(),
  bedrooms: z.number().nullable(),
  bathrooms: z.number().nullable(),
  familySize: z.number().nullable(),
  lifestyle: z.array(z.string()).nullable(),
  amenities: z.array(z.string()).nullable(),
  specialRequirements: z.string().nullable(),
  keyword: z.string().nullable(),
  missingCriticalInfo: z.boolean(),
  clarifyingQuestion: z.string().nullable(),
});

// The real contract applied to whatever the model actually returned.
const domainPlanSchema = z.object({
  city: z.string().trim().min(1).nullable(),
  country: z.string().trim().min(1).nullable(),
  minPrice: z.number().nonnegative().nullable(),
  maxPrice: z.number().nonnegative().nullable(),
  bedrooms: z.number().int().nonnegative().nullable(),
  bathrooms: z.number().int().nonnegative().nullable(),
  familySize: z.number().int().positive().nullable(),
  lifestyle: z.array(z.string().trim().min(1)).nullable(),
  amenities: z.array(z.string().trim().min(1)).nullable(),
  specialRequirements: z.string().trim().min(1).nullable(),
  keyword: z.string().trim().min(1).nullable(),
  clarifyingQuestion: z.string().trim().min(1).nullable(),
});

const DEFAULT_CLARIFYING_QUESTION =
  "I can help with that. Which city are you looking in, and what's your budget?";

const buildUserInput = (prompt, previousPlan) =>
  previousPlan
    ? `Previous extracted intent (JSON): ${JSON.stringify(previousPlan)}\n\nNew message: ${prompt}`
    : prompt;

// Whether we have enough to search at all is decided here deterministically
// from the final merged fields — never trusted blindly from the model's own
// boolean, so a model miscalculation can't silently break the flow either way.
const withCriticalInfoCheck = (fields) => {
  const missingCriticalInfo = !(fields.city || fields.minPrice != null || fields.maxPrice != null);
  return {
    ...fields,
    missingCriticalInfo,
    clarifyingQuestion: missingCriticalInfo
      ? fields.clarifyingQuestion || DEFAULT_CLARIFYING_QUESTION
      : null,
  };
};

const fallbackPlan = () =>
  withCriticalInfoCheck({
    city: null,
    country: null,
    minPrice: null,
    maxPrice: null,
    bedrooms: null,
    bathrooms: null,
    familySize: null,
    lifestyle: [],
    amenities: [],
    specialRequirements: null,
    keyword: null,
    clarifyingQuestion: null,
  });

// Planner: Call 1 of the agent's 2-LLM-call budget. Understands the user's
// goal and extracts structured intent — never searches, scores, or ranks
// anything itself. Never retried on failure (that would risk exceeding the
// 2-call budget); any failure here degrades to a plain clarifying question
// instead, at zero additional LLM cost.
export const planQuery = async (prompt, previousPlan = null) => {
  let parsed;
  try {
    const openai = getClient();
    const response = await openai.responses.parse({
      model: MODEL,
      input: [
        { role: "system", content: PLANNER_SYSTEM_PROMPT },
        { role: "user", content: buildUserInput(prompt, previousPlan) },
      ],
      text: { format: zodTextFormat(wirePlanSchema, "property_plan") },
    });
    parsed = response.output_parsed;
  } catch (err) {
    console.error("Planner LLM call failed, falling back to clarifying question:", mapOpenAIError(err).message);
    return fallbackPlan();
  }

  if (parsed === null) return fallbackPlan();

  const result = domainPlanSchema.safeParse(parsed);
  if (!result.success) return fallbackPlan();

  return withCriticalInfoCheck({
    city: result.data.city,
    country: result.data.country,
    minPrice: result.data.minPrice,
    maxPrice: result.data.maxPrice,
    bedrooms: result.data.bedrooms,
    bathrooms: result.data.bathrooms,
    familySize: result.data.familySize,
    lifestyle: result.data.lifestyle ?? [],
    amenities: result.data.amenities ?? [],
    specialRequirements: result.data.specialRequirements,
    keyword: result.data.keyword,
    clarifyingQuestion: result.data.clarifyingQuestion,
  });
};

// Converts a plan into exactly the filter shape the existing Search Service
// already expects — city/country/minPrice/maxPrice/bedrooms/bathrooms/keyword,
// present only when actually known (matching searchService's own convention
// of "absent" rather than null for unset filters).
export const toSearchFilters = (plan) =>
  Object.fromEntries(
    Object.entries({
      city: plan.city,
      country: plan.country,
      minPrice: plan.minPrice,
      maxPrice: plan.maxPrice,
      bedrooms: plan.bedrooms,
      bathrooms: plan.bathrooms,
      keyword: plan.keyword,
    }).filter(([, value]) => value !== null && value !== undefined)
  );
