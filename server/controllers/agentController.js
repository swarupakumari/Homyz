import asyncHandler from "express-async-handler";
import { getPropertyAdvice } from "../services/agentService.js";

const MAX_PROMPT_LENGTH = 500;

// POST /api/agent/advice — the Agentic AI Property Advisor. Delegates
// everything to agentService.getPropertyAdvice, which plans the user's
// intent and then orchestrates the existing Search Service and
// Recommendation Engine plus the Comparison and Report services. This
// controller performs no searching, scoring, or ranking itself — it only
// validates input and forwards it.
export const getAdvice = asyncHandler(async (req, res) => {
  const { prompt, previousQueryAnalysis } = req.body;

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

  if (
    previousQueryAnalysis !== undefined &&
    previousQueryAnalysis !== null &&
    (typeof previousQueryAnalysis !== "object" || Array.isArray(previousQueryAnalysis))
  ) {
    return res.status(400).json({
      success: false,
      message: "'previousQueryAnalysis', if provided, must be an object.",
    });
  }

  // Conversation memory: the client passes back the `queryAnalysis` object
  // from its previous response (see docs/agent.md) so a follow-up message
  // like "now only pet friendly" refines the prior search instead of
  // starting over. Nothing is stored server-side — memory lives only for
  // as long as the client keeps sending it back, which naturally ends when
  // the chat session/modal closes.
  const advice = await getPropertyAdvice(prompt.trim(), previousQueryAnalysis || null);

  res.status(200).json(advice);
});
