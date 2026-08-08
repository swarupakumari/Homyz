import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { IoCloseOutline, IoSend } from "react-icons/io5";
import { BsRobot } from "react-icons/bs";
import "./AiSearch.css";
import useAgentAdvisor from "../../hooks/useAgentAdvisor";
import ChatMessage from "./ChatMessage";
import SuggestionChips from "./SuggestionChips";
import TypingIndicator from "./TypingIndicator";

const FOCUSABLE_SELECTOR =
  'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])';

// Floating conversational AI search. Mounted once (in Layout) so it's
// available from every page without disturbing the existing per-page
// SearchBar or any other UI.
const AiSearchModal = ({ isOpen, onClose }) => {
  const { messages, sendMessage, isLoading } = useAgentAdvisor();
  const [draft, setDraft] = useState("");

  const modalRef = useRef(null);
  const textareaRef = useRef(null);
  const bottomRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  const isOpenRef = useRef(isOpen);
  const openPathRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  // Auto-close if the route changes while open (e.g. the user clicked a
  // PropertyCard result inside the conversation and navigated away).
  useEffect(() => {
    if (isOpenRef.current && openPathRef.current !== null && location.pathname !== openPathRef.current) {
      onClose();
    }
    // Intentionally only reacts to path changes — isOpen/onClose are read
    // via refs/closure so opening the modal itself never re-triggers this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (isOpen) {
      openPathRef.current = location.pathname;
      previouslyFocusedRef.current = document.activeElement;
      document.body.style.overflow = "hidden";
      const focusTimeout = setTimeout(() => textareaRef.current?.focus(), 50);
      return () => {
        clearTimeout(focusTimeout);
        document.body.style.overflow = "";
      };
    }
    previouslyFocusedRef.current?.focus?.();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  // Return focus to the input once a reply arrives, so the disabled ->
  // enabled textarea (which React blurs while disabled) doesn't strand
  // focus on <body> after every turn.
  useEffect(() => {
    if (isOpen && !isLoading) {
      textareaRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // Escape-to-close and Tab focus-trapping are attached at the document
  // level rather than via onKeyDown on the panel: the textarea is disabled
  // (and therefore blurred, per React) while a request is in flight, which
  // moves focus to <body> — outside the panel's DOM subtree — so a
  // bubble-based handler on the panel itself would silently stop working
  // for exactly the moments a user is most likely to hit Escape.
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        // Disabled elements (e.g. the send button while the draft is
        // empty, or the whole input row while a request is in flight)
        // match the selector but aren't actually tabbable — a disabled
        // element can't receive focus, so it must be excluded here or
        // the trap can compute a "last" element that .focus() no-ops on.
        const focusable = Array.from(
          modalRef.current.querySelectorAll(FOCUSABLE_SELECTOR)
        ).filter((el) => !el.disabled);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = () => {
    if (!draft.trim() || isLoading) return;
    sendMessage(draft);
    setDraft("");
  };

  const handleTextareaKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="ai-search-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-search-title"
            className="ai-search-modal"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="ai-search-header">
              <div className="ai-search-header-title" id="ai-search-title">
                <BsRobot size={20} aria-hidden="true" />
                AI Property Advisor
              </div>
              <button
                type="button"
                className="ai-search-close-btn"
                onClick={onClose}
                aria-label="Close AI search"
              >
                <IoCloseOutline size={20} />
              </button>
            </div>

            <div className="ai-search-conversation" aria-live="polite">
              {messages.length === 0 && (
                <>
                  <div className="ai-search-welcome">
                    <strong>Tell me about the home you're looking for.</strong>
                    Try something like "I'm moving to Bangalore with my family of four, budget 1 crore, need parking and a safe neighborhood."
                  </div>
                  <SuggestionChips onSelect={sendMessage} disabled={isLoading} />
                </>
              )}

              {messages.map((message) => (
                <ChatMessage message={message} key={message.id} />
              ))}

              {isLoading && <TypingIndicator />}

              <div ref={bottomRef} />
            </div>

            <div className="ai-search-input-row">
              <textarea
                ref={textareaRef}
                className="ai-search-textarea"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleTextareaKeyDown}
                placeholder="Describe what you're looking for..."
                aria-label="Describe the property you're looking for"
                rows={1}
                disabled={isLoading}
              />
              <button
                type="button"
                className="ai-search-send-btn"
                onClick={handleSubmit}
                disabled={isLoading || !draft.trim()}
                aria-label="Send"
              >
                <IoSend size={16} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AiSearchModal;
