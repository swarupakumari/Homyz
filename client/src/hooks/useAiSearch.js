import { useCallback, useState } from "react";
import { useMutation } from "react-query";
import axios from "axios";
import { aiSearchProperties } from "../utils/api";

// Translates a raw Axios/network failure into a friendly, user-facing
// sentence for the chat UI. Mirrors the HTTP status codes the backend AI
// layer documents (timeout/504, rate limit/429, not configured/503,
// invalid output/422, generic 5xx/502).
const getFriendlyErrorMessage = (error) => {
  if (axios.isAxiosError(error)) {
    if (error.code === "ECONNABORTED") {
      return "That took too long to answer. Please try again.";
    }
    if (!error.response) {
      return "Can't reach the server right now. Check your connection and try again.";
    }

    const { status, data } = error.response;

    if (status === 429) {
      return "AI search is getting a lot of requests right now — please wait a moment and try again.";
    }
    if (status === 422) {
      return "I couldn't turn that into a search. Try rephrasing it, e.g. \"3 bedroom apartment in Chicago under 5000\".";
    }
    if (status === 503) {
      return "AI search is temporarily unavailable. Please try again shortly.";
    }
    if (status === 504) {
      return "The AI took too long to respond. Please try again.";
    }
    if (status >= 500) {
      return "Something went wrong on our end. Please try again.";
    }
    if (status === 400) {
      return data?.message || "That request wasn't valid. Try rephrasing it.";
    }
  }
  return "Something went wrong. Please try again.";
};

let messageIdCounter = 0;
const nextMessageId = () => {
  messageIdCounter += 1;
  return `ai-msg-${Date.now()}-${messageIdCounter}`;
};

// Owns the AI Search conversation: message history, sending a prompt to
// POST /api/ai/search, and turning the response (or failure) into a
// chat message. Never touches the Search Service directly — the backend
// endpoint already does that.
const useAiSearch = () => {
  const [messages, setMessages] = useState([]);

  const { mutateAsync, isLoading } = useMutation({
    mutationFn: aiSearchProperties,
  });

  const sendMessage = useCallback(
    async (prompt) => {
      const trimmed = prompt.trim();
      if (!trimmed || isLoading) return;

      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId(),
          role: "user",
          text: trimmed,
          timestamp: Date.now(),
        },
      ]);

      try {
        const result = await mutateAsync(trimmed);
        setMessages((prev) => [
          ...prev,
          {
            id: nextMessageId(),
            role: "assistant",
            timestamp: Date.now(),
            summary: result.summary,
            parsedFilters: result.parsedFilters,
            recommendations: result.recommendations,
          },
        ]);
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextMessageId(),
            role: "assistant",
            timestamp: Date.now(),
            error: getFriendlyErrorMessage(error),
          },
        ]);
      }
    },
    [isLoading, mutateAsync]
  );

  return { messages, sendMessage, isLoading };
};

export default useAiSearch;
