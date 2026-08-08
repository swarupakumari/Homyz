import { useCallback, useRef, useState } from "react";
import { useMutation } from "react-query";
import axios from "axios";
import { getAgentAdvice } from "../utils/api";

// Mirrors useAiSearch.js's error-mapping approach, adjusted for the
// advisor's own status codes (it never throws its own 422 — a bad plan
// degrades to a clarifying question instead, at the backend level).
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
      return "The advisor is getting a lot of requests right now — please wait a moment and try again.";
    }
    if (status === 503) {
      return "The AI advisor is temporarily unavailable. Please try again shortly.";
    }
    if (status === 504) {
      return "The advisor took too long to respond. Please try again.";
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
  return `agent-msg-${Date.now()}-${messageIdCounter}`;
};

// Owns the Agentic AI Property Advisor conversation: message history, and
// sending a prompt to POST /api/agent/advice. Carries the previous turn's
// `queryAnalysis` forward as `previousQueryAnalysis`, so a follow-up like
// "now only pet friendly" refines the prior search instead of starting
// over — this is the conversation memory the backend planner merges
// against. Memory lives only in this hook's state (a plain ref + React
// state), never persisted server-side, so it naturally resets whenever
// the component that mounts this hook does (i.e. when the chat session/
// modal ends).
const useAgentAdvisor = () => {
  const [messages, setMessages] = useState([]);
  const previousQueryAnalysisRef = useRef(null);

  const { mutateAsync, isLoading } = useMutation({
    mutationFn: ({ prompt, previousQueryAnalysis }) =>
      getAgentAdvice(prompt, previousQueryAnalysis),
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
        const result = await mutateAsync({
          prompt: trimmed,
          previousQueryAnalysis: previousQueryAnalysisRef.current,
        });

        // Remember this turn's understanding for the next message, whether
        // or not this turn actually ran a search (a clarifying-question
        // turn still has a partial queryAnalysis worth carrying forward).
        previousQueryAnalysisRef.current = result.queryAnalysis || null;

        if (result.needsClarification) {
          setMessages((prev) => [
            ...prev,
            {
              id: nextMessageId(),
              role: "assistant",
              kind: "clarification",
              timestamp: Date.now(),
              clarifyingQuestion: result.clarifyingQuestion,
            },
          ]);
          return;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: nextMessageId(),
            role: "assistant",
            kind: "advisor-report",
            timestamp: Date.now(),
            report: result,
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

export default useAgentAdvisor;
