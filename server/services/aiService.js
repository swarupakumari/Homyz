import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { AI_SYSTEM_PROMPT } from "../utils/aiPrompt.js";

// Structural schema handed to the OpenAI Responses API. OpenAI's strict
// Structured Outputs mode does not enforce refinements like min/max/int
// (some are ignored, others can make the API reject the request outright),
// so this stays deliberately permissive: every field is a plain nullable
// string or number. Real validation happens in `domainFiltersSchema` below,
// against the value the model actually returned.
const wireFiltersSchema = z.object({
  city: z.string().nullable(),
  country: z.string().nullable(),
  minPrice: z.number().nullable(),
  maxPrice: z.number().nullable(),
  bedrooms: z.number().nullable(),
  bathrooms: z.number().nullable(),
  keyword: z.string().nullable(),
});

// The real contract extracted filters must satisfy before they are allowed
// anywhere near the Search Service. This is intentionally stricter than
// what the API guarantees, so the retry-then-422 flow below is meaningful.
const domainFiltersSchema = z
  .object({
    city: z.string().trim().min(1).nullable(),
    country: z.string().trim().min(1).nullable(),
    minPrice: z.number().nonnegative().nullable(),
    maxPrice: z.number().nonnegative().nullable(),
    bedrooms: z.number().int().nonnegative().nullable(),
    bathrooms: z.number().int().nonnegative().nullable(),
    keyword: z.string().trim().min(1).nullable(),
  })
  .refine(
    (value) =>
      value.minPrice === null ||
      value.maxPrice === null ||
      value.minPrice <= value.maxPrice,
    { message: "minPrice must not be greater than maxPrice" }
  );

export class AIServiceError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = "AIServiceError";
    this.status = status;
  }
}

// Exported (alongside the AIServiceError class already exported above) so
// the Agent services (Sprint 4: plannerService.js, reportService.js) can
// reuse the exact same client/model/error-mapping setup instead of
// duplicating it — nothing about how these are used elsewhere changes.
export const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

let client;
export const getClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new AIServiceError(
      "AI search is not configured on the server.",
      503
    );
  }
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 20_000,
      maxRetries: 1,
    });
  }
  return client;
};

// Maps OpenAI SDK/API failures onto meaningful HTTP status codes. Invalid
// *content* (bad JSON/refusal) is handled separately by the retry loop in
// extractSearchFilters — this only covers transport/provider-level failures.
export const mapOpenAIError = (err) => {
  if (err instanceof AIServiceError) return err;
  if (err instanceof OpenAI.APIConnectionTimeoutError) {
    return new AIServiceError(
      "The AI provider timed out. Please try again.",
      504
    );
  }
  if (err instanceof OpenAI.RateLimitError) {
    return new AIServiceError(
      "AI provider rate limit exceeded. Please try again shortly.",
      429
    );
  }
  if (
    err instanceof OpenAI.AuthenticationError ||
    err instanceof OpenAI.PermissionDeniedError
  ) {
    return new AIServiceError(
      "AI provider rejected the request due to a server configuration issue.",
      503
    );
  }
  if (err instanceof OpenAI.APIError) {
    return new AIServiceError(
      "The AI provider returned an unexpected error.",
      502
    );
  }
  return new AIServiceError(
    "Unexpected error while contacting the AI provider.",
    502
  );
};

// Single call to the model. Throws AIServiceError on transport/provider
// failures; returns null (never throws) when the model produced no
// parseable content, so the caller can decide whether to retry.
const requestFilters = async (prompt) => {
  const openai = getClient();

  try {
    const response = await openai.responses.parse({
      model: MODEL,
      input: [
        { role: "system", content: AI_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      text: { format: zodTextFormat(wireFiltersSchema, "search_filters") },
    });
    return response.output_parsed;
  } catch (err) {
    throw mapOpenAIError(err);
  }
};

// Strips nulls so the object matches what searchService.buildSearchFilter
// expects (fields are simply absent when not provided, never null).
const toSearchFilters = (parsed) =>
  Object.fromEntries(
    Object.entries(parsed).filter(([, value]) => value !== null)
  );

// Converts a natural-language property search prompt into validated,
// structured search filters. This function never touches the database —
// the caller is responsible for passing the result into the existing
// Search Service.
export const extractSearchFilters = async (prompt) => {
  const attempts = 2;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const parsed = await requestFilters(prompt);

    if (parsed !== null) {
      const result = domainFiltersSchema.safeParse(parsed);
      if (result.success) {
        return toSearchFilters(result.data);
      }
    }

    if (attempt === attempts) {
      throw new AIServiceError(
        "The AI did not return a valid set of search filters after retrying.",
        422
      );
    }
  }
};

// Used only by the Recommendation Engine (server/services/recommendationService.js)
// to rephrase already-decided match reasons into one friendly sentence.
// The model is given nothing but a list of short reason strings — no
// prices, filters, or property data — and is explicitly forbidden from
// scoring, ranking, or adding claims of its own.
const RECOMMENDATION_EXPLANATION_PROMPT = `You write one short, friendly sentence explaining why a property matched a buyer's search.

You will receive a JSON array of short reason strings that have ALREADY been determined to be true — you are not deciding what matches, only rephrasing.

Rules:
- Use only the reasons provided. Never add, invent, or imply any claim not present in the list.
- Never mention a score, ranking, or percentage.
- Write exactly one sentence, friendly and natural, no markdown, no bullet points, no preamble.`;

// Converts a deterministic list of match reasons (already computed by the
// Recommendation Engine's scoring rules) into one friendly sentence. Never
// throws — an explanation is a nice-to-have, so any failure here should
// fall back to the caller's own deterministic phrasing rather than break
// the request.
export const explainRecommendationReasons = async (reasons) => {
  if (!reasons || reasons.length === 0) return null;

  try {
    const openai = getClient();
    const response = await openai.responses.create({
      model: MODEL,
      input: [
        { role: "system", content: RECOMMENDATION_EXPLANATION_PROMPT },
        { role: "user", content: JSON.stringify(reasons) },
      ],
    });
    return response.output_text?.trim() || null;
  } catch {
    return null;
  }
};
