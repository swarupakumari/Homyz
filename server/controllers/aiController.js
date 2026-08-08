import asyncHandler from "express-async-handler";
import { extractSearchFilters, AIServiceError } from "../services/aiService.js";
import { searchResidencies } from "../services/searchService.js";
import { rankProperties } from "../services/recommendationService.js";

const MAX_PROMPT_LENGTH = 500;

// POST /api/ai/search — translates a natural language prompt into
// structured search filters via aiService, hands those filters, unmodified,
// to the existing Search Service, then deterministically ranks the results
// via the Recommendation Engine. This controller never builds a database
// query itself and never asks the LLM to decide a score or ordering.
export const searchWithAI = asyncHandler(async (req, res) => {
  const { prompt } = req.body;

  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: "'prompt' is required and must be a non-empty string.",
    });
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `'prompt' must be ${MAX_PROMPT_LENGTH} characters or fewer.`,
    });
  }

  let filters;
  try {
    filters = await extractSearchFilters(prompt.trim());
  } catch (err) {
    if (err instanceof AIServiceError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    throw err;
  }

  const { data, total } = await searchResidencies(filters);
  const recommendations = await rankProperties(filters, data);

  res.status(200).json({
    success: true,
    summary: `Found ${total} matching propert${total === 1 ? "y" : "ies"}.`,
    parsedFilters: filters,
    recommendations,
  });
});
